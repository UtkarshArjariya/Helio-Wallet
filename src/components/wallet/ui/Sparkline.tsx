import React, { useCallback, useMemo, useRef, useState } from 'react'
import { cn } from '../../../lib/utils'

/* ─────────────────────────── Design notes ──────────────────────────────
 *
 * Aesthetic: Bloomberg-terminal × editorial chart. The line is the brand
 * lime (#C6F000) when up and a warm coral (#FF6B6B) when down — coral
 * instead of the alert-red `--danger`, because a price dip is not an error.
 * The area fill carries a royal-blue undertone toward the baseline so the
 * chart reads as brand-aware rather than the stock green/red of every web3
 * wallet sparkline.
 *
 * Crosshair: a 0.75px dashed vertical guide in muted text color, a target-
 * reticule focus dot (line-colored ring around a jet center, plus a tiny
 * line-colored pip inside), and a floating price-tag pill above the chart.
 * The pill snaps to the nearest data point and clamps to chart edges via a
 * translateX so it never clips on either side.
 *
 * Interaction: pointer events unify mouse + touch. We only setState when
 * the snapped index actually changes, so dragging across hundreds of
 * candles is essentially free — React reconciles a couple of svg <line>/
 * <circle> nodes per frame, nothing more.
 *
 * Performance: no requestAnimationFrame throttling needed — at ~60 hover
 * events/sec with a single state update per index-change the render path
 * stays under one frame budget. No chart library; no new deps.
 * ────────────────────────────────────────────────────────────────────── */

const VB_W = 600
const VB_H = 176
const PAD_Y = 6
/**
 * Horizontal inset. We deliberately leave a tiny `PAD_X` so the rounded
 * endpoint of the stroke (linecap="round") doesn't render half-outside the
 * SVG viewport on the very last segment. The chart card itself is now a
 * precision rectangle (no rounded corners), so we don't need to compensate
 * for a corner mask anymore.
 */
const PAD_X = 1

/** Lime accent for upward trend (brand signature). */
const UP_COLOR    = '#C6F000'
/** Warm coral for downward trend — softer than the system danger red. */
const DOWN_COLOR  = '#FF6B6B'
/** Royal-blue undertone bled into the area fill toward the baseline. */
const BASELINE_TINT = '#1A1FB8'

export interface SparklinePoint {
  /** Series value (close price). */
  readonly value: number
  /** Unix seconds — surfaced by the tooltip when present. */
  readonly time?: number
}

export function Sparkline({
  values,
  points,
  className,
  strokeWidth = 1.75,
  formatPrice,
  formatTime,
}: {
  /** Legacy plain-number API; either this or `points` must be provided. */
  values?: readonly number[]
  /** Preferred — includes timestamps for the tooltip. */
  points?: readonly SparklinePoint[]
  className?: string
  strokeWidth?: number
  /** Tooltip price formatter. Defaults to `$x,xxx.xx`. */
  formatPrice?: (value: number) => string
  /** Tooltip timestamp formatter. Defaults to short locale time. */
  formatTime?: (unixSec: number) => string
}) {
  const seriesPoints = useMemo<readonly SparklinePoint[]>(() => {
    const raw = points && points.length > 0
      ? points
      : (values ?? []).map(v => ({ value: v }))
    // Filter out placeholder / zero-priced candles. Some long-range Jupiter
    // responses pad early history with zeros for tokens that didn't exist yet
    // — those would collapse the entire Y axis if we plotted them.
    return raw.filter(p => Number.isFinite(p.value) && p.value > 0)
  }, [points, values])

  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const idRef = useRef<string>(
    `spk-${Math.random().toString(36).slice(2, 9)}`,
  )

  // Geometry — only recomputed when the data changes.
  const geom = useMemo(() => {
    if (seriesPoints.length < 2) return null

    const vals = seriesPoints.map(p => p.value)
    const min  = Math.min(...vals)
    const max  = Math.max(...vals)
    const span = max - min || 1
    const innerH = VB_H - PAD_Y * 2
    const innerW = VB_W - PAD_X * 2
    const stepX = innerW / (seriesPoints.length - 1)

    const pts: ReadonlyArray<readonly [number, number]> = seriesPoints.map((p, i) => [
      PAD_X + i * stepX,
      PAD_Y + (1 - (p.value - min) / span) * innerH,
    ])

    // Smoothed line: quadratic Bezier through midpoints. Cheap, no library.
    let d = `M ${pts[0]![0].toFixed(2)} ${pts[0]![1].toFixed(2)}`
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1]!
      const [x1, y1] = pts[i]!
      const cx = (x0 + x1) / 2
      d += ` Q ${cx.toFixed(2)} ${y0.toFixed(2)} ${x1.toFixed(2)} ${y1.toFixed(2)}`
    }
    const linePath = d
    // Close the area down to baseline, then sweep back along the bottom edge.
    const lastX = pts[pts.length - 1]![0].toFixed(2)
    const areaPath = `${d} L ${lastX} ${VB_H} L ${PAD_X.toFixed(2)} ${VB_H} Z`

    const isUp = seriesPoints[seriesPoints.length - 1]!.value >= seriesPoints[0]!.value
    return { pts, linePath, areaPath, stepX, isUp }
  }, [seriesPoints])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container || seriesPoints.length < 2) return
    const rect = container.getBoundingClientRect()
    // Map pointer-x in container pixels → ratio across the padded drawing area
    // (PAD_X .. VB_W - PAD_X), so the first and last data points are reachable
    // when the cursor is at the visible chart edges.
    const padPxLeft  = (PAD_X / VB_W) * rect.width
    const padPxRight = (PAD_X / VB_W) * rect.width
    const usable = Math.max(1, rect.width - padPxLeft - padPxRight)
    const xPx = event.clientX - rect.left - padPxLeft
    const ratio = Math.max(0, Math.min(1, xPx / usable))
    const idx = Math.round(ratio * (seriesPoints.length - 1))
    setActiveIndex(prev => (prev === idx ? prev : idx))
  }, [seriesPoints.length])

  const handlePointerLeave = useCallback(() => setActiveIndex(null), [])

  if (!geom) return null

  const { pts, linePath, areaPath, isUp } = geom
  const lineColor = isUp ? UP_COLOR : DOWN_COLOR
  const areaId    = `${idRef.current}-area`
  const lineId    = `${idRef.current}-line`

  const active = activeIndex != null && activeIndex >= 0 && activeIndex < pts.length
    ? { idx: activeIndex, x: pts[activeIndex]![0], y: pts[activeIndex]![1] }
    : null

  // Tooltip placement. The chart card uses `overflow-hidden`, so the tooltip
  // MUST live inside the chart bounds — placing it above with translateY(-100%)
  // gets clipped to invisibility.
  //
  // Horizontal: anchor at `left: <activePctX>%`, then translateX so it stays
  // on the visible portion of the chart even near edges.
  // Vertical: if the focus dot is in the top half, the tooltip sits BELOW it.
  // Otherwise above. Either way it stays inside the chart.
  const activePctX = active ? (active.x / VB_W) * 100 : 0
  const activePctY = active ? (active.y / VB_H) * 100 : 0
  const tooltipShiftX =
    activePctX < 14 ? -activePctX * 0.8
    : activePctX > 86 ? -100 + (100 - activePctX) * 0.8
    : -50
  const showBelow = active != null && active.y < VB_H * 0.45
  // translateY moves the pill away from the dot in the chosen direction.
  // Below: 14px below the dot. Above: anchor it by its own height plus 14px.
  const tooltipShiftY = showBelow ? '14px' : 'calc(-100% - 14px)'

  const activePoint  = active != null ? seriesPoints[active.idx]! : null
  const priceFmt = formatPrice ?? defaultPriceFormat
  const timeFmt  = formatTime  ?? defaultTimeFormat

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerLeave}
      className={cn('relative w-full h-full', className)}
      style={{ touchAction: 'pan-y' }}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        className="block w-full h-full"
        aria-hidden="true"
      >
        <defs>
          {/* Line-to-baseline area gradient with a royal-blue undertone at
              the very bottom — keeps the chart from looking like a generic
              green/red wash. */}
          <linearGradient id={areaId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor={lineColor}    stopOpacity="0.34" />
            <stop offset="55%"  stopColor={lineColor}    stopOpacity="0.10" />
            <stop offset="100%" stopColor={BASELINE_TINT} stopOpacity="0.06" />
          </linearGradient>

          {/* A thin highlight along the top edge of the stroke — pure
              styling, exaggerates the curve under low contrast. */}
          <linearGradient id={lineId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%"   stopColor={lineColor} stopOpacity="0.85" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Area first so the line sits on top */}
        <path d={areaPath} fill={`url(#${areaId})`} />

        {/* Line — animated draw-in via stroke-dashoffset.
            pathLength="1" normalizes the intrinsic path length to 1, so the
            dash math is independent of how long the actual curve is. Without
            this, volatile ranges (large Y deltas → long path) could exceed a
            fixed dasharray cap and leave the tail invisible. */}
        <path
          d={linePath}
          fill="none"
          stroke={`url(#${lineId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="spk-line"
          pathLength={1}
          vectorEffect="non-scaling-stroke"
        />

        {/* "Live" endcap — a pulsing marker at the most recent candle so the
            line clearly terminates at the right edge instead of looking like
            it ran out of canvas. Hidden while the user is hovering. */}
        {!active && (
          <g pointerEvents="none">
            {/* Outer pulse ring */}
            <circle
              cx={pts[pts.length - 1]![0]}
              cy={pts[pts.length - 1]![1]}
              r={5}
              fill={lineColor}
              opacity={0.22}
              className="spk-pulse"
            />
            {/* Solid core dot */}
            <circle
              cx={pts[pts.length - 1]![0]}
              cy={pts[pts.length - 1]![1]}
              r={2.5}
              fill={lineColor}
            />
            {/* Hairline border so the dot pops against any background */}
            <circle
              cx={pts[pts.length - 1]![0]}
              cy={pts[pts.length - 1]![1]}
              r={2.5}
              fill="none"
              stroke="var(--bg, #000)"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}

        {/* Crosshair + reticule */}
        {active && (
          <g pointerEvents="none">
            <line
              x1={active.x} x2={active.x}
              y1={2} y2={VB_H - 2}
              stroke="var(--text-muted)"
              strokeOpacity="0.55"
              strokeWidth={0.75}
              strokeDasharray="2 3"
              vectorEffect="non-scaling-stroke"
            />
            {/* Outer ring */}
            <circle
              cx={active.x} cy={active.y}
              r={5.5}
              fill="var(--bg, #000)"
              stroke={lineColor}
              strokeWidth={1.75}
              vectorEffect="non-scaling-stroke"
            />
            {/* Inner pip */}
            <circle
              cx={active.x} cy={active.y}
              r={1.5}
              fill={lineColor}
            />
          </g>
        )}
      </svg>

      {/* Tooltip — anchored INSIDE the chart bounds (the parent has
          overflow-hidden; anything outside gets clipped). DOM-positioned so
          its typography stays crisp regardless of the SVG viewBox stretch. */}
      {active && activePoint && (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            left: `${activePctX}%`,
            top:  `${activePctY}%`,
            transform: `translateX(${tooltipShiftX}%) translateY(${tooltipShiftY})`,
          }}
        >
          <div
            className="flex flex-col items-start gap-0.5 px-3 py-2 rounded-md whitespace-nowrap"
            style={{
              background: 'var(--surface-2, rgba(20,20,20,0.96))',
              backdropFilter: 'blur(6px)',
              boxShadow:
                '0 10px 30px -10px rgba(0,0,0,0.6), inset 0 0 0 1px ' +
                lineColor + '66',
            }}
          >
            <span
              className="font-eyebrow text-[9px] uppercase tracking-[0.16em]"
              style={{ color: 'var(--text-muted)' }}
            >
              {activePoint.time != null ? timeFmt(activePoint.time) : `Point ${active.idx + 1}`}
            </span>
            <span
              className="font-figure text-sm font-semibold tabular-nums"
              style={{ color: lineColor }}
            >
              {priceFmt(activePoint.value)}
            </span>
          </div>
        </div>
      )}

      {/* Local styles — entrance draw animation + live-endcap pulse. */}
      <style>{`
        .spk-line {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: spk-draw 420ms cubic-bezier(.22,1,.36,1) forwards;
        }
        @keyframes spk-draw {
          to { stroke-dashoffset: 0; }
        }
        .spk-pulse {
          transform-origin: center;
          transform-box: fill-box;
          animation: spk-pulse 2.4s cubic-bezier(.4,0,.2,1) infinite;
        }
        @keyframes spk-pulse {
          0%   { transform: scale(0.8); opacity: 0.18; }
          50%  { transform: scale(1.6); opacity: 0.0; }
          100% { transform: scale(0.8); opacity: 0.18; }
        }
        @media (prefers-reduced-motion: reduce) {
          .spk-line {
            stroke-dasharray: none;
            stroke-dashoffset: 0;
            animation: none;
          }
          .spk-pulse { animation: none; }
        }
      `}</style>
    </div>
  )
}

function defaultPriceFormat(value: number): string {
  if (value < 1) {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`
  }
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function defaultTimeFormat(unixSec: number): string {
  const d = new Date(unixSec * 1000)
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
