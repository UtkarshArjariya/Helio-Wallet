import React from 'react'
import { cn } from '../../../lib/utils'

type Props = {
  value: number          // 0..1
  size?: number
  strokeWidth?: number
  className?: string
  label?: React.ReactNode
  sublabel?: React.ReactNode
  trackColor?: string
  gradientId?: string
}

export function ProgressRing({
  value,
  size = 160,
  strokeWidth = 10,
  className,
  label,
  sublabel,
  trackColor = 'rgba(255,255,255,0.06)',
  gradientId = 'helio-progress-gradient',
}: Props) {
  const clamped = Math.max(0, Math.min(1, isFinite(value) ? value : 0))
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - clamped)

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="var(--accent-primary)" />
            <stop offset="100%" stopColor="var(--accent-secondary)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={`url(#${gradientId})`} strokeWidth={strokeWidth} fill="none"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
        {label && <div className="text-text-primary text-xl font-semibold tracking-tight">{label}</div>}
        {sublabel && <div className="text-text-muted text-xs mt-0.5">{sublabel}</div>}
      </div>
    </div>
  )
}
