import React, { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowUpRight, ArrowDownToLine, Repeat, ExternalLink, Loader2, Shield,
} from 'lucide-react'
import type { JupiterCandle, JupiterChartInterval } from '@helio/api'
import { useRouter } from '../contexts/RouterContext'
import { useWallet, WRAPPED_SOL_MINT } from '../contexts/WalletContext'
import { ScreenHeader } from '../components/wallet/ui/ScreenHeader'
import { TokenIcon } from '../components/wallet/ui/TokenIcon'
import { Sparkline } from '../components/wallet/ui/Sparkline'
import { useTokenMetadata } from '../lib/use-token-metadata'
import { jupiterChartsClient } from '../lib/rpc-service'
import { solscanAccountUrl } from '../lib/explorer'
import { cn } from '../lib/utils'

/* ─────────────────────────── Design notes ──────────────────────────────
 *
 * Direction: Bloomberg-terminal × editorial financial magazine. Constrained
 * measure (≤ 64rem) so 1920px browsers don't sprawl. Centered identity
 * header. Tabular monospace data rows with dotted leaders between label and
 * value (financial-statement convention) rather than the boring two-cell
 * cards. A trio-rule (thin / thick / thin) section divider lifted from
 * Bloomberg data strips. Two-column Info / Meta split at md+ so the page
 * reads as one cohesive spread rather than a vertical scroll of slabs.
 *
 * Brand discipline: lime accent and royal-blue glow only — no purple
 * gradients. Verified pill uses Shield (auth/safety semantics) rather than
 * a sparkle, which reads more institutional.
 *
 * Motion: framer-motion (already a workspace dep) drives a staggered
 * page-load cascade. Honors prefers-reduced-motion.
 * ────────────────────────────────────────────────────────────────────── */

type Range = '1H' | '1D' | '1W' | '1M' | 'YTD' | 'ALL'
const RANGES: Range[] = ['1H', '1D', '1W', '1M', 'YTD', 'ALL']

function rangeToFetch(range: Range): { interval: JupiterChartInterval; count: number } {
  switch (range) {
    case '1H':  return { interval: '1_MINUTE', count: 60 }
    case '1D':  return { interval: '5_MINUTE', count: 288 }
    case '1W':  return { interval: '1_HOUR',   count: 168 }
    case '1M':  return { interval: '1_DAY',    count: 30 }
    case 'YTD': {
      const start = new Date(new Date().getUTCFullYear(), 0, 1).getTime()
      const days = Math.max(1, Math.ceil((Date.now() - start) / 86_400_000))
      return { interval: '1_DAY', count: days }
    }
    case 'ALL': return { interval: '1_DAY', count: 365 }
  }
}

function formatCandleTime(unixSec: number, range: Range): string {
  const d = new Date(unixSec * 1000)
  if (range === '1H' || range === '1D') {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }
  if (range === '1W') {
    return d.toLocaleString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

/* ───────────────────────── Component ─────────────────────────────── */

export function TokenDetailScreen() {
  const { location, navigate } = useRouter()
  const { tokens } = useWallet()
  const reduce = useReducedMotion()

  const [range,         setRange]        = useState<Range>('1D')
  const [candles,       setCandles]      = useState<readonly JupiterCandle[]>([])
  const [chartLoading,  setChartLoading] = useState(false)
  const [chartErr,      setChartErr]     = useState<string | null>(null)

  const id          = decodeURIComponent(location.replace(/^\/token\//, ''))
  const held        = tokens.find(t => t.id === id)
  const mintToFetch = held?.mintAddress ?? (id === 'sol' ? WRAPPED_SOL_MINT : id)
  const { data: meta } = useTokenMetadata(mintToFetch)

  useEffect(() => {
    if (!mintToFetch) return
    let cancelled = false
    setChartLoading(true)
    setChartErr(null)
    const { interval, count } = rangeToFetch(range)
    jupiterChartsClient
      .getCandles(mintToFetch, interval, count)
      .then(rows => { if (!cancelled) setCandles(rows) })
      .catch(e   => { if (!cancelled) setChartErr(e?.message ?? 'Failed to load chart') })
      .finally(() => { if (!cancelled) setChartLoading(false) })
    return () => { cancelled = true }
  }, [mintToFetch, range])

  const closes       = candles.map(c => c.close)
  const sparkPoints  = candles.map(c => ({ value: c.close, time: c.time }))
  const chartChange  = closes.length >= 2
    ? ((closes[closes.length - 1]! - closes[0]!) / closes[0]!) * 100
    : 0

  const symbol     = held?.symbol     ?? meta?.symbol     ?? '—'
  const name       = held?.name       ?? meta?.name       ?? 'Unknown token'
  const iconUrl    = held?.iconUrl    ?? meta?.icon       ?? null
  const isVerified = held?.isVerified ?? meta?.isVerified ?? false
  const tags       = held?.tags       ?? meta?.tags       ?? []
  const decimals   = meta?.decimals   ?? 9
  const price      = held?.price      ?? 0
  const change24h  = held?.change24h  ?? 0
  const balance    = held?.balance    ?? 0
  const fiat       = balance * price
  const networkLabel = id === 'sol' ? 'Solana · Native' : 'Solana · SPL Token'

  // Staggered entrance for the major blocks.
  const stagger = (i: number) => ({
    initial:    reduce ? false as const : { opacity: 0, y: 8 },
    animate:    { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay: 0.04 * i, ease: [0.22, 1, 0.36, 1] as const },
  })

  return (
    <div className="flex flex-col pb-16">
      <ScreenHeader
        title={name}
        subtitle={symbol}
        rightSlot={
          isVerified ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-eyebrow text-[10px]"
              style={{
                background: 'rgba(198,240,0,0.08)',
                color: 'var(--accent-primary)',
                boxShadow: 'inset 0 0 0 1px rgba(198,240,0,0.25)',
              }}
            >
              <Shield className="h-3 w-3" strokeWidth={2.2} />
              VERIFIED
            </span>
          ) : null
        }
      />

      {/* Constrained editorial measure — 64rem max */}
      <div className="relative mx-auto w-full max-w-[64rem] px-4 md:px-8 lg:px-12 pt-3">
        {/* Brand atmosphere — distant blue and lime tints. Behind everything. */}
        <div
          className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full"
          style={{ background: 'rgba(26,31,184,0.16)', filter: 'blur(90px)', zIndex: 0 }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 top-60 h-72 w-72 rounded-full"
          style={{ background: 'rgba(198,240,0,0.07)', filter: 'blur(110px)', zIndex: 0 }}
          aria-hidden
        />

        <div className="relative" style={{ isolation: 'isolate' }}>
          {/* ── 1. Identity slab ─────────────────────────────────────── */}
          <motion.section {...stagger(0)} className="pt-2 pb-4">
            <div className="flex flex-col items-center gap-3 md:flex-row md:items-end md:gap-5">
              <div className="relative">
                <TokenIcon token={{ symbol, iconUrl }} size={64} className="shadow-xl" />
                {isVerified && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ background: 'var(--bg)', boxShadow: '0 0 0 2px var(--bg)' }}
                  >
                    <Shield className="h-3 w-3" style={{ color: 'var(--accent-primary)' }} strokeWidth={2.4} />
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0 text-center md:text-left">
                <div className="font-eyebrow text-text-muted text-[10px] tracking-[0.18em]">
                  TOKEN · {symbol}
                </div>
                <div className="mt-1 flex items-baseline gap-3 justify-center md:justify-start leading-none">
                  <h1 className="font-heading text-text-primary text-2xl md:text-3xl font-bold tracking-tight">
                    {name}
                  </h1>
                </div>
              </div>

              <div className="text-center md:text-right">
                <div className="font-eyebrow text-text-muted text-[10px] tracking-[0.18em]">SPOT</div>
                <div className="mt-1 flex items-baseline gap-2 justify-center md:justify-end leading-none">
                  <span className="font-figure text-text-primary text-3xl md:text-4xl font-extrabold tabular-nums">
                    ${price.toLocaleString('en-US', {
                      minimumFractionDigits: price < 1 ? 4 : 2,
                      maximumFractionDigits: price < 1 ? 6 : 2,
                    })}
                  </span>
                </div>
                <div className={cn(
                  'mt-1.5 font-mono text-xs',
                  change24h >= 0 ? 'text-success' : 'text-danger',
                )}>
                  {change24h >= 0 ? '▲' : '▼'} {Math.abs(change24h).toFixed(2)}%
                  <span className="ml-1.5 text-text-muted">24H</span>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Decorative trio rule — Bloomberg data-strip homage */}
          <TrioRule />

          {/* ── 2. Chart slab ────────────────────────────────────────── */}
          <motion.section {...stagger(1)} className="pt-4">
            <div
              className="relative"
              style={{
                background: 'var(--surface-1, rgba(255,255,255,0.02))',
                boxShadow:
                  'inset 0 0 0 1px var(--border-subtle), 0 18px 60px -40px rgba(26,31,184,0.45)',
                borderRadius: 4,
              }}
            >
              {/* Subtle horizontal grid for visual weight without competing
                  with the line. Hidden when no data so the empty state isn't
                  cluttered. */}
              {closes.length >= 2 && (
                <div className="pointer-events-none absolute inset-0" aria-hidden>
                  {[0.25, 0.5, 0.75].map((p) => (
                    <div
                      key={p}
                      className="absolute left-0 right-0 h-px"
                      style={{ top: `${p * 100}%`, background: 'var(--border-subtle)', opacity: 0.6 }}
                    />
                  ))}
                </div>
              )}

              <div className="h-56 md:h-72 relative">
                {chartLoading && closes.length === 0 ? (
                  <Centered>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-text-muted" />
                    <span className="text-text-muted text-xs">Fetching candles…</span>
                  </Centered>
                ) : chartErr && closes.length === 0 ? (
                  <Centered column>
                    <div className="text-text-primary/30 font-figure text-3xl font-extrabold tabular-nums">⋯</div>
                    <div className="mt-1 text-text-muted text-xs">Couldn't load chart.</div>
                  </Centered>
                ) : closes.length < 2 ? (
                  <Centered column>
                    <div className="text-text-primary/30 font-figure text-3xl font-extrabold tabular-nums">⋯</div>
                    <div className="mt-1 text-text-muted text-xs">Price history unavailable for this range.</div>
                  </Centered>
                ) : (
                  <Sparkline
                    points={sparkPoints}
                    className="absolute inset-0"
                    formatTime={(t) => formatCandleTime(t, range)}
                  />
                )}
              </div>

              {/* Chart footer strip — range delta + last candle stamp */}
              {closes.length >= 2 && (
                <div
                  className="flex items-center justify-between px-4 py-2 border-t"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <span className="font-eyebrow text-text-muted text-[10px] tracking-[0.18em]">
                    {range} · {closes.length} POINTS
                  </span>
                  <span className={cn(
                    'font-mono text-xs',
                    chartChange >= 0 ? 'text-success' : 'text-danger',
                  )}>
                    {chartChange >= 0 ? '+' : ''}{chartChange.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>

            {/* Range dial — segmented control with terminal feel */}
            <div
              className="mt-3 flex items-center gap-0.5 rounded-md p-0.5"
              style={{ background: 'var(--surface-2)' }}
            >
              {RANGES.map(r => {
                const active = range === r
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={cn(
                      'flex-1 rounded px-2 py-1.5 font-eyebrow text-[10px] tracking-[0.16em] transition-colors',
                      active ? 'text-bg' : 'text-text-muted hover:text-text-primary',
                    )}
                    style={active ? {
                      background: 'var(--accent-primary)',
                      color: 'var(--accent-primary-foreground, #000)',
                    } : undefined}
                  >
                    {r}
                  </button>
                )
              })}
            </div>
          </motion.section>

          {/* ── 3. Actions ────────────────────────────────────────────── */}
          <motion.section {...stagger(2)} className="pt-5">
            <div className="flex flex-wrap items-stretch gap-2 sm:gap-3 justify-center md:justify-start">
              <ActionChip label="Send"    icon={ArrowUpRight}    onClick={() => navigate('/send')} />
              <ActionChip label="Receive" icon={ArrowDownToLine} onClick={() => navigate('/receive')} />
              <ActionChip label="Swap"    icon={Repeat}          onClick={() => navigate('/swap')} />
            </div>
          </motion.section>

          {/* ── 4. Position slab (full bleed inside measure) ─────────── */}
          {(balance > 0 || held) && (
            <motion.section {...stagger(3)} className="pt-6">
              <SectionEyebrow label="POSITION" />
              <div
                className="mt-2 rounded-xl px-4 py-4 md:px-5 md:py-5 flex flex-col md:flex-row md:items-end md:justify-between gap-3"
                style={{
                  background: 'var(--surface-1, rgba(255,255,255,0.015))',
                  boxShadow: 'inset 0 0 0 1px var(--border-subtle)',
                }}
              >
                <div>
                  <div className="font-eyebrow text-text-muted text-[10px] tracking-[0.18em]">BALANCE</div>
                  <div className="mt-1 font-figure text-text-primary text-2xl md:text-[28px] font-extrabold tabular-nums leading-none">
                    {balance.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                    <span className="ml-2 text-text-muted text-base font-bold">{symbol}</span>
                  </div>
                </div>
                <div className="md:text-right">
                  <div className="font-eyebrow text-text-muted text-[10px] tracking-[0.18em]">USD VALUE</div>
                  <div className="mt-1 font-mono text-text-primary text-lg tabular-nums leading-none">
                    ${fiat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {/* ── 5. Info + Meta — two-column on md+ ──────────────────── */}
          <motion.section {...stagger(4)} className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Info — datasheet with dotted leaders */}
            <div>
              <SectionEyebrow label="INFO" />
              <div className="mt-2 space-y-0">
                <DataRow label="Name"    value={name} />
                <DataRow label="Symbol"  value={symbol} mono />
                <DataRow label="Network" value={networkLabel} />
                <DataRow label="Decimals" value={decimals.toString()} mono />
                {mintToFetch && (
                  <DataRow
                    label="Mint"
                    value={
                      <a
                        href={solscanAccountUrl(mintToFetch)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-text-primary hover:text-accent-primary transition-colors"
                      >
                        {mintToFetch.slice(0, 4)}…{mintToFetch.slice(-4)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    }
                  />
                )}
              </div>
            </div>

            {/* Meta — verification & tags */}
            <div>
              <SectionEyebrow label="META" />
              <div className="mt-2 space-y-3">
                <div
                  className="rounded-lg px-3 py-3"
                  style={{
                    background: 'var(--surface-1, rgba(255,255,255,0.015))',
                    boxShadow: 'inset 0 0 0 1px var(--border-subtle)',
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <Shield
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: isVerified ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                      strokeWidth={2.2}
                    />
                    <div className="min-w-0">
                      <div className="text-text-primary text-sm font-medium">
                        {isVerified ? 'Verified by Jupiter' : 'Unverified'}
                      </div>
                      <div className="text-text-muted text-xs mt-0.5 leading-relaxed">
                        {isVerified
                          ? 'This token is on the Jupiter verified list — recognized name, symbol, and on-chain metadata.'
                          : 'Token is not on the Jupiter verified list. Double-check the mint address before swapping or sending.'}
                      </div>
                    </div>
                  </div>
                </div>

                {tags.length > 0 && (
                  <div>
                    <div className="font-eyebrow text-text-muted text-[10px] tracking-[0.18em] mb-1.5">
                      TAGS
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map(tag => (
                        <span
                          key={tag}
                          className="rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider"
                          style={{
                            background: 'var(--surface-2)',
                            color: 'var(--text-secondary)',
                            boxShadow: 'inset 0 0 0 1px var(--border-subtle)',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.section>

          {/* Disclaimer footer */}
          <motion.section {...stagger(5)} className="pt-8">
            <p className="text-text-muted text-[11px] leading-relaxed max-w-2xl mx-auto md:mx-0 text-center md:text-left">
              Past performance is not an indicator of future performance. Token prices are sourced
              from Jupiter aggregator routing across Solana DEXs and may differ from individual
              venue prices.
            </p>
          </motion.section>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── Sub-components ─────────────────────────── */

function Centered({
  children, column,
}: { children: React.ReactNode; column?: boolean }) {
  return (
    <div className={cn(
      'absolute inset-0 flex items-center justify-center gap-2',
      column && 'flex-col gap-0',
    )}>
      {children}
    </div>
  )
}

function SectionEyebrow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-1 w-1 rounded-full" style={{ background: 'var(--accent-primary)' }} />
      <span className="font-eyebrow text-text-muted text-[10px] tracking-[0.22em]">
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
    </div>
  )
}

/**
 * Trio-rule divider: hairline, thicker bar, hairline — three stacked rules
 * with a touch of negative space between, lifted from the kind of data-strip
 * headers you see on Bloomberg / FT print layouts.
 */
function TrioRule() {
  return (
    <div className="py-2" aria-hidden>
      <div className="h-px" style={{ background: 'var(--border-subtle)' }} />
      <div
        className="mt-1 h-[2px]"
        style={{
          background: 'linear-gradient(to right, transparent, var(--text-muted) 30%, var(--text-muted) 70%, transparent)',
          opacity: 0.5,
        }}
      />
      <div className="mt-1 h-px" style={{ background: 'var(--border-subtle)' }} />
    </div>
  )
}

/**
 * Financial-statement row with a label, a dotted leader, and a right-aligned
 * value. Reads as a datasheet rather than a card — the dotted line carries
 * the eye across the row even at wide measures.
 */
function DataRow({
  label, value, mono,
}: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 py-2.5">
      <span className="text-text-muted text-xs shrink-0 uppercase tracking-wider font-mono">{label}</span>
      <span
        className="flex-1 self-end translate-y-[-3px] opacity-60"
        style={{
          height: 1,
          // Crisp dotted leader: 2-px-on / 2-px-off via repeating gradient.
          // Renders sharper than a radial-gradient at sub-pixel offsets.
          backgroundImage:
            'repeating-linear-gradient(to right, var(--border-subtle) 0 2px, transparent 2px 5px)',
        }}
        aria-hidden
      />
      <span className={cn(
        'text-sm shrink-0 text-text-primary',
        mono && 'font-mono tabular-nums',
      )}>
        {value}
      </span>
    </div>
  )
}

function ActionChip({
  label, icon: Icon, onClick,
}: { label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative inline-flex items-center gap-2.5 rounded-lg px-4 py-2.5 overflow-hidden transition-all hover:-translate-y-px"
      style={{
        background: 'var(--surface-2)',
        boxShadow: 'inset 0 0 0 1px var(--border-subtle)',
      }}
    >
      {/* Hover wash — lime tint sweeps left→right behind the label */}
      <span
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background:
            'linear-gradient(105deg, transparent 0%, rgba(198,240,0,0.08) 50%, transparent 100%)',
        }}
        aria-hidden
      />
      <span
        className="relative flex h-7 w-7 items-center justify-center rounded-md"
        style={{
          background: 'rgba(198,240,0,0.12)',
          color: 'var(--accent-primary)',
          boxShadow: 'inset 0 0 0 1px rgba(198,240,0,0.18)',
        }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="relative text-text-primary text-sm font-medium tracking-tight">
        {label}
      </span>
    </button>
  )
}
