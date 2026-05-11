import React from 'react'

/**
 * Helio glyph system.
 *
 * Geometric stroke icons drawn in a 24×24 viewBox using `currentColor`,
 * stroke-width 1.6, round caps + joins. Used for the proprietary action set
 * (Deposit / Send / Swap / Stake / Vault) — distinct from Lucide which we keep
 * for utility chrome (chevrons, close, copy, ...).
 *
 * Each glyph leans on a single visual idea so the four actions read as a
 * family at a glance: a triangle, a chevron, two arcs, three bars, a sun.
 */

type GlyphProps = {
  className?: string
  size?: number
  strokeWidth?: number
  style?: React.CSSProperties
}

const baseProps = (size: number, strokeWidth: number, className?: string, style?: React.CSSProperties) => ({
  viewBox: '0 0 24 24',
  width: size,
  height: size,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
  style,
  'aria-hidden': true,
})

/** ▼ into ⊔  — funds descending into an open bracket. */
export function DepositGlyph({ className, size = 24, strokeWidth = 1.6, style }: GlyphProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className, style)}>
      {/* Arrow shaft */}
      <path d="M12 4v9" />
      {/* Arrowhead — equilateral triangle pointing down */}
      <path d="M8 9.5 12 13.5 16 9.5" />
      {/* Open cup catching the deposit */}
      <path d="M5 14v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

/** Diagonal launch — small origin dot + a sharp up-right chevron. */
export function SendGlyph({ className, size = 24, strokeWidth = 1.6, style }: GlyphProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className, style)}>
      {/* Origin dot */}
      <circle cx="6" cy="18" r="1.2" fill="currentColor" stroke="none" />
      {/* Diagonal shaft */}
      <path d="M7.2 16.8 17 7" />
      {/* Chevron head */}
      <path d="M11 6h6v6" />
    </svg>
  )
}

/** Two arcs in opposing rotation — swap as continuous circulation. */
export function SwapGlyph({ className, size = 24, strokeWidth = 1.6, style }: GlyphProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className, style)}>
      {/* Top arc → right */}
      <path d="M4 9a6 6 0 0 1 10.5-2.5" />
      <path d="M11.5 4 15 6.5l-2.5 3" />
      {/* Bottom arc ← left */}
      <path d="M20 15a6 6 0 0 1-10.5 2.5" />
      <path d="M12.5 20 9 17.5l2.5-3" />
    </svg>
  )
}

/** Three offset bars — increasing accumulation, the staking ladder. */
export function StakeGlyph({ className, size = 24, strokeWidth = 1.6, style }: GlyphProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className, style)}>
      <rect x="4"   y="14" width="16" height="3" rx="1" />
      <rect x="6"   y="9"  width="12" height="3" rx="1" />
      <rect x="8.5" y="4"  width="7"  height="3" rx="1" />
    </svg>
  )
}

/** Helio sun — center dot, six radial rays, one lime planet off-axis. */
export function VaultGlyph({ className, size = 24, strokeWidth = 1.6, style }: GlyphProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className, style)}>
      {/* Core */}
      <circle cx="12" cy="12" r="3" />
      {/* Six rays */}
      <path d="M12 3v2.5" />
      <path d="M12 18.5V21" />
      <path d="M3 12h2.5" />
      <path d="M18.5 12H21" />
      <path d="m5.5 5.5 1.8 1.8" />
      <path d="m16.7 16.7 1.8 1.8" />
      <path d="m18.5 5.5-1.8 1.8" />
      <path d="m7.3 16.7-1.8 1.8" />
    </svg>
  )
}

/** Receive — circle with an arrow plunging into it. Mirror of Send. */
export function ReceiveGlyph({ className, size = 24, strokeWidth = 1.6, style }: GlyphProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className, style)}>
      <circle cx="18" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <path d="M16.8 7.2 7 17" />
      <path d="M13 18H7v-6" />
    </svg>
  )
}
