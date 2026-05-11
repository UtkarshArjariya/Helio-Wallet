import React from 'react'
import { cn } from '../../../lib/utils'

/**
 * Decorative SVG: tilted orbital ring system used as an overlay on hero
 * cards and empty states. Theme-aware via stroke="currentColor".
 */
export function OrbitalPattern({
  className,
  rings = 4,
  style,
}: {
  className?: string
  rings?: number
  style?: React.CSSProperties
}) {
  const ringRadii = Array.from({ length: rings }).map((_, i) => 80 + i * 40)
  return (
    <svg
      viewBox="0 0 400 400"
      className={cn('text-text-primary/15', className)}
      style={style}
      fill="none"
      aria-hidden="true"
    >
      <g transform="rotate(-18 200 200)">
        {ringRadii.map((r, i) => (
          <ellipse
            key={r}
            cx="200"
            cy="200"
            rx={r}
            ry={r * 0.36}
            stroke="currentColor"
            strokeWidth={i === 0 ? 1.2 : 0.8}
            opacity={1 - i * 0.18}
          />
        ))}
        <circle cx={200 + 80}  cy={200}      r={4}   fill="var(--accent-primary)" />
        <circle cx={200 - 120} cy={200 - 12} r={2.5} fill="var(--accent-secondary)" />
        <circle cx={200 + 160} cy={200 + 8}  r={2}   fill="var(--accent-tertiary)" />
      </g>
    </svg>
  )
}
