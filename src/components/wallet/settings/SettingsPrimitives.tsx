import React from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { cn } from '../../../lib/utils'

/** Section container with an optional eyebrow label above. */
export function SettingsSection({
  label, children, className,
}: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-2', className)}>
      {label && (
        <div className="px-1 font-eyebrow text-text-muted text-[10px]">{label}</div>
      )}
      <div className="rounded-3xl helio-card overflow-hidden">
        {children}
      </div>
    </section>
  )
}

/** A list item with an icon, label, optional sublabel, and a chevron. */
export function SettingsRow({
  icon: Icon, label, sub, danger, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  sub?: string
  danger?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-2.5 hover:bg-surface-3 transition-colors text-left"
    >
      <span
        className={
          danger
            ? 'flex h-8 w-8 items-center justify-center rounded-xl bg-danger/10 text-danger shrink-0'
            : 'flex h-8 w-8 items-center justify-center rounded-xl text-text-secondary shrink-0'
        }
        style={danger ? {} : { background: 'var(--surface-3)' }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className={danger ? 'text-danger text-sm font-medium' : 'text-text-primary text-sm font-medium'}>
          {label}
        </div>
        {sub && <div className="text-text-muted text-xs">{sub}</div>}
      </div>
      <ChevronRight className="h-4 w-4 text-text-muted shrink-0" />
    </button>
  )
}

/** Radio-style option row used in pickers (language, currency, network, …). */
export function OptionRow<T extends string | number>({
  label, value, current, sub, onSelect,
}: {
  label: string
  value: T
  current: T
  sub?: string
  onSelect: (v: T) => void
}) {
  const active = value === current
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className="flex w-full items-center gap-3 px-4 py-3 hover:bg-surface-3 transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <div className={cn('text-sm font-medium', active ? 'text-text-primary' : 'text-text-secondary')}>
          {label}
        </div>
        {sub && <div className="text-text-muted text-xs mt-0.5">{sub}</div>}
      </div>
      {active && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-primary text-accent-primary-foreground shrink-0">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}
    </button>
  )
}

/** Switch-style row with a toggle. */
export function ToggleRow({
  label, sub, checked, onChange,
}: {
  label: string
  sub?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="text-text-primary text-sm font-medium">{label}</div>
        {sub && <div className="text-text-muted text-xs mt-0.5 leading-relaxed">{sub}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative h-5 w-9 shrink-0 rounded-full mt-0.5 transition-colors',
          checked ? 'bg-accent-primary' : 'bg-surface-4')}
      >
        <span className={cn(
          'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
          checked && 'translate-x-4',
        )} />
      </button>
    </div>
  )
}

/** Visual separator inside a section. */
export function SettingsDivider() {
  return <div className="h-px mx-3" style={{ background: 'var(--border-subtle)' }} />
}
