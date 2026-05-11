import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { OrbitalPattern } from './OrbitalPattern'
import { cn } from '../../../lib/utils'

type Action = {
  label: string
  onClick?: () => void
  icon?: React.ComponentType<{ className?: string }>
  href?: string
  external?: boolean
}

/**
 * Editorial empty state.
 *
 * Defaults to a "dormant terminal readout" — giant tabular figure,
 * uppercase eyebrow, title, body, action buttons. Orbital pattern in the
 * corner ties it to the brand. Variants:
 *  - `density="compact"` → no orbital, smaller figure, single-column actions.
 *    Use in tight spaces (Home recent activity, vault history tab).
 *  - `figure` defaults to a typographic placeholder like "00.0000".
 *
 * Animates in with a soft fade-up that respects prefers-reduced-motion.
 */
export function EmptyState({
  eyebrow, figure, figureUnit, headline, body, primary, secondary,
  density = 'normal', className,
}: {
  eyebrow?: string
  figure?: string
  figureUnit?: string
  headline: string
  body?: React.ReactNode
  primary?: Action
  secondary?: Action
  density?: 'normal' | 'compact'
  className?: string
}) {
  const reduce = useReducedMotion()
  const compact = density === 'compact'

  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative overflow-hidden rounded-3xl helio-card helio-noise',
        compact ? 'px-5 py-6' : 'px-6 py-8',
        className,
      )}
    >
      {!compact && (
        <OrbitalPattern
          className="pointer-events-none absolute -right-20 -bottom-24 h-[280px] w-[280px] opacity-40"
          style={{ zIndex: -1 }}
        />
      )}
      {!compact && (
        <div
          className="pointer-events-none absolute -left-10 top-1/2 -translate-y-1/2 h-32 w-32 rounded-full"
          style={{ background: 'rgba(198,240,0,0.10)', filter: 'blur(50px)', zIndex: -1 }}
        />
      )}

      <div className="relative flex flex-col items-start gap-2.5" style={{ isolation: 'isolate' }}>
        {eyebrow && (
          <span className="font-eyebrow text-text-muted text-[10px] inline-flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-text-muted" />
            {eyebrow}
          </span>
        )}

        {figure && (
          <div className="flex items-baseline gap-2 leading-none">
            <span
              className={cn(
                'font-figure font-extrabold text-text-primary/30 tabular-nums tracking-tighter select-none',
                compact ? 'text-[40px]' : 'text-[64px]',
              )}
            >
              {figure}
            </span>
            {figureUnit && (
              <span className="font-figure text-text-muted text-base font-bold tabular-nums">
                {figureUnit}
              </span>
            )}
          </div>
        )}

        <div className="space-y-1.5 max-w-[28ch]">
          <h3 className={cn(
            'font-heading font-bold text-text-primary tracking-tight',
            compact ? 'text-base' : 'text-lg',
          )}>
            {headline}
          </h3>
          {body && (
            <p className="text-text-muted text-xs leading-relaxed">
              {body}
            </p>
          )}
        </div>

        {(primary || secondary) && (
          <div className={cn(
            'flex gap-2 pt-1',
            compact ? 'flex-row' : 'flex-row flex-wrap',
          )}>
            {primary && <ActionButton {...primary} variant="primary" />}
            {secondary && <ActionButton {...secondary} variant="secondary" />}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function ActionButton({
  label, onClick, icon: Icon, href, external, variant,
}: Action & { variant: 'primary' | 'secondary' }) {
  const className =
    variant === 'primary'
      ? 'inline-flex items-center gap-1.5 rounded-full bg-accent-primary px-4 py-2 text-xs font-semibold text-accent-primary-foreground hover:bg-accent-primary-hover transition-colors'
      : 'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium text-text-primary hover:bg-surface-3 transition-colors'

  const inner = (
    <>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        onClick={onClick}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        className={className}
        style={variant === 'secondary' ? { background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' } : undefined}
      >
        {inner}
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={variant === 'secondary' ? { background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' } : undefined}
    >
      {inner}
    </button>
  )
}
