import React, { useState, useMemo } from 'react'
import { Filter, Search, ArrowUpRight, ArrowDownLeft, Repeat, Sparkles, Layers } from 'lucide-react'
import { cn } from '../lib/utils'

const MOCK_ACTIVITY = [
  { id: '1', kind: 'vault', title: 'Vault Round-up', subtitle: 'Auto-sweep triggered', amount: '+0.012 SOL', positive: true, date: '2026-05-10T14:30:00Z' },
  { id: '2', kind: 'swap', title: 'Swap SOL → USDC', subtitle: 'Jupiter route via Orca', amount: '+145.20 USDC', positive: true, date: '2026-05-09T10:15:00Z' },
  { id: '3', kind: 'receive', title: 'Received SOL', subtitle: 'From 4nJ6...Apd9', amount: '+1.50 SOL', positive: true, date: '2026-05-08T16:00:00Z' },
  { id: '4', kind: 'send', title: 'Sent SOL', subtitle: 'To 67sN...9n5G', amount: '−0.25 SOL', positive: false, date: '2026-05-07T13:45:00Z' },
  { id: '5', kind: 'stake', title: 'Staked SOL', subtitle: 'Helio Validator', amount: '−1.00 SOL', positive: false, date: '2026-05-06T09:00:00Z' },
  { id: '6', kind: 'vault', title: 'Vault Deployed', subtitle: 'Threshold reached', amount: '−0.10 SOL', positive: false, date: '2026-05-05T18:20:00Z' },
]

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'send', label: 'Sent' },
  { id: 'receive', label: 'Received' },
  { id: 'swap', label: 'Swaps' },
  { id: 'vault', label: 'Vault' },
  { id: 'stake', label: 'Staking' },
] as const

const kindIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  vault: Sparkles, swap: Repeat, receive: ArrowDownLeft, send: ArrowUpRight, stake: Layers,
}

export function ActivityScreen() {
  const [filter, setFilter] = useState<string>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => MOCK_ACTIVITY.filter((a) => {
    if (filter !== 'all' && !a.kind.startsWith(filter)) return false
    return a.title.toLowerCase().includes(query.toLowerCase()) || a.subtitle.toLowerCase().includes(query.toLowerCase())
  }), [filter, query])

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const a of filtered) {
      const day = new Date(a.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(a)
    }
    return Array.from(map.entries())
  }, [filtered])

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <div className="text-text-primary font-heading font-semibold">Activity</div>
          <div className="text-text-muted text-xs">{MOCK_ACTIVITY.length} events</div>
        </div>
        <button type="button" aria-label="Filter"
          className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:text-text-primary transition-colors"
          style={{ background: 'var(--surface-2)' }}>
          <Filter className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Search */}
        <div className="flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm text-text-muted"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
          <Search className="h-4 w-4 shrink-0" />
          <input type="text" placeholder="Search activity" value={query} onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none placeholder:text-text-muted text-text-primary" />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto helio-scrollbar -mx-4 px-4 pb-1">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)}
              className={cn('rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors border',
                filter === f.id
                  ? 'bg-accent-primary text-accent-primary-foreground border-transparent'
                  : 'text-text-secondary hover:text-text-primary')}
              style={{ background: filter === f.id ? undefined : 'var(--surface-2)', borderColor: filter === f.id ? 'transparent' : 'var(--border-subtle)' }}>
              {f.label}
            </button>
          ))}
        </div>

        {grouped.length === 0 ? (
          <div className="rounded-3xl helio-card p-10 text-center">
            <div className="text-text-muted text-sm">No activity found.</div>
          </div>
        ) : grouped.map(([day, items]) => (
          <div key={day} className="rounded-3xl helio-card p-2">
            <div className="px-3 py-2 text-text-muted text-[11px] uppercase tracking-wider">{day}</div>
            <div className="space-y-0.5">
              {items.map((a) => {
                const Icon = kindIcon[a.kind] ?? ArrowUpRight
                return (
                  <div key={a.id} className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-surface-3 transition-colors cursor-pointer">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-secondary"
                      style={{ background: 'var(--surface-3)' }}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-text-primary text-sm font-medium">{a.title}</div>
                      <div className="text-text-muted text-xs truncate">{a.subtitle}</div>
                    </div>
                    <div className={cn('text-sm font-medium shrink-0', a.positive ? 'text-success' : 'text-text-primary')}>{a.amount}</div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
