import { cn } from '../../../lib/utils'

export type VaultStatus =
  | 'inactive'
  | 'accumulating'
  | 'threshold-reached'
  | 'deploying'
  | 'deployed'
  | 'paused'

const MAP: Record<VaultStatus, { label: string; dot: string; text: string; bg: string }> = {
  inactive:            { label: 'Inactive',           dot: 'bg-text-muted',       text: 'text-text-secondary', bg: 'bg-surface-3' },
  accumulating:        { label: 'Accumulating',       dot: 'bg-accent-primary',   text: 'text-accent-primary', bg: 'bg-accent-primary/10' },
  'threshold-reached': { label: 'Threshold reached',  dot: 'bg-success',          text: 'text-success',        bg: 'bg-success/10' },
  deploying:           { label: 'Deploying',          dot: 'bg-info',             text: 'text-info',           bg: 'bg-info/10' },
  deployed:            { label: 'Deployed',           dot: 'bg-success',          text: 'text-success',        bg: 'bg-success/10' },
  paused:              { label: 'Paused',             dot: 'bg-warning',          text: 'text-warning',        bg: 'bg-warning/10' },
}

export function VaultStatusPill({
  status, className, size = 'md',
}: { status: VaultStatus; className?: string; size?: 'sm' | 'md' }) {
  const s = MAP[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full font-medium border',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        s.bg, s.text, className,
      )}
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot, status === 'accumulating' && 'animate-pulse')} />
      {s.label}
    </span>
  )
}
