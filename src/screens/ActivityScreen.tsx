import React, { useState, useMemo } from 'react'
import { Filter, Search, ArrowUpRight, ArrowDownLeft, Repeat, Sparkles, Layers } from 'lucide-react'
import { useWallet } from '../contexts/WalletContext'
import { cn } from '../lib/utils'

type FilterId = 'all' | 'send' | 'receive' | 'swap' | 'vault' | 'stake'

interface ActivityItem {
  id: string
  kind: string
  title: string
  subtitle: string
  amount: string
  positive: boolean
  date: string  // ISO string
}

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all',     label: 'All' },
  { id: 'send',    label: 'Sent' },
  { id: 'receive', label: 'Received' },
  { id: 'swap',    label: 'Swaps' },
  { id: 'vault',   label: 'Vault' },
  { id: 'stake',   label: 'Staking' },
]

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  vault:   Sparkles,
  sweep:   Sparkles,
  swap:    Repeat,
  receive: ArrowDownLeft,
  send:    ArrowUpRight,
  stake:   Layers,
}

/** Build synthetic activity from on-chain reserve state. */
function buildVaultActivity(vault: ReturnType<typeof useWallet>['vault']): ActivityItem[] {
  const items: ActivityItem[] = []

  if (vault.lastSweepAt > 0) {
    items.push({
      id: 'vault-sweep',
      kind: 'vault',
      title: 'Vault sweep',
      subtitle: `${vault.balance.toFixed(4)} SOL in reserve`,
      amount: `${vault.balance.toFixed(4)} SOL`,
      positive: true,
      date: new Date(vault.lastSweepAt * 1000).toISOString(),
    })
  }

  if (vault.lastWithdrawAt > 0) {
    items.push({
      id: 'vault-withdraw',
      kind: 'vault',
      title: 'Vault withdrawal',
      subtitle: 'Withdrawn from reserve',
      amount: '— SOL',
      positive: false,
      date: new Date(vault.lastWithdrawAt * 1000).toISOString(),
    })
  }

  return items
}

export function ActivityScreen() {
  const { vault } = useWallet()
  const [filter, setFilter] = useState<FilterId>('all')
  const [query,  setQuery]  = useState('')

  // Real vault events derived from on-chain state, plus a static placeholder
  // for off-chain history (future: index via Helius webhooks)
  const allActivity = useMemo((): ActivityItem[] => {
    const vaultItems = buildVaultActivity(vault)
    const onChainCount = vaultItems.length

    // Only show placeholder rows when there's no real data yet
    if (onChainCount === 0) {
      return [
        { id: 'ph-1', kind: 'receive', title: 'No activity yet', subtitle: 'Your on-chain activity will appear here', amount: '', positive: true, date: new Date().toISOString() },
      ]
    }

    return vaultItems
  }, [vault])

  const filtered = useMemo(() => allActivity.filter(a => {
    const kindMatch = filter === 'all' || a.kind === filter || (filter === 'vault' && (a.kind === 'vault' || a.kind === 'sweep'))
    const queryMatch = !query || a.title.toLowerCase().includes(query.toLowerCase()) || a.subtitle.toLowerCase().includes(query.toLowerCase())
    return kindMatch && queryMatch
  }), [filter, query, allActivity])

  const grouped = useMemo(() => {
    const map = new Map<string, ActivityItem[]>()
    for (const a of filtered) {
      const day = new Date(a.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(a)
    }
    return Array.from(map.entries())
  }, [filtered])

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <div className="text-text-primary font-heading font-semibold">Activity</div>
          <div className="text-text-muted text-xs">{allActivity.length} events</div>
        </div>
        <button type="button" aria-label="Filter"
          className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:text-text-primary transition-colors"
          style={{ background: 'var(--surface-2)' }}>
          <Filter className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 rounded-2xl border px-3 py-2.5"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
          <Search className="h-4 w-4 shrink-0 text-text-muted" />
          <input type="text" placeholder="Search activity" value={query} onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none placeholder:text-text-muted text-text-primary text-sm" />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto helio-scrollbar -mx-4 px-4 pb-1">
          {FILTERS.map(f => (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)}
              className={cn('rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors border',
                filter === f.id ? 'bg-accent-primary text-accent-primary-foreground border-transparent' : 'text-text-secondary hover:text-text-primary')}
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
              {items.map(a => {
                const Icon = KIND_ICON[a.kind] ?? ArrowUpRight
                return (
                  <div key={a.id} className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-surface-3 transition-colors cursor-pointer">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: 'var(--surface-3)', color: a.positive ? 'var(--success)' : 'var(--text-secondary)' }}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-text-primary text-sm font-medium">{a.title}</div>
                      <div className="text-text-muted text-xs truncate">{a.subtitle}</div>
                    </div>
                    {a.amount && (
                      <div className={cn('text-sm font-medium shrink-0', a.positive ? 'text-success' : 'text-text-primary')}>
                        {a.amount}
                      </div>
                    )}
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
