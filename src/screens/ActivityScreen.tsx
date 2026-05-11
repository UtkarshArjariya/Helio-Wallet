import React, { useMemo, useState } from 'react'
import { Search, ArrowDownLeft, ArrowUpRight, RotateCw, Loader2, AlertTriangle } from 'lucide-react'
import { useWallet } from '../contexts/WalletContext'
import { useRouter } from '../contexts/RouterContext'
import { cn } from '../lib/utils'
import { ScreenHeader } from '../components/wallet/ui/ScreenHeader'
import { ActivityRow, type ActivityItem } from '../components/wallet/ui/ActivityRow'
import { EmptyState } from '../components/wallet/ui/EmptyState'
import { useRecentTransactions } from '../lib/transaction-history'

const FILTERS = [
  { id: 'all',     label: 'All' },
  { id: 'send',    label: 'Sent' },
  { id: 'receive', label: 'Received' },
  { id: 'swap',    label: 'Swaps' },
  { id: 'vault',   label: 'Vault' },
  { id: 'stake',   label: 'Staking' },
] as const

type FilterId = (typeof FILTERS)[number]['id']

export function ActivityScreen() {
  const { address } = useWallet()
  const { navigate } = useRouter()
  const [filter, setFilter] = useState<FilterId>('all')
  const [query,  setQuery]  = useState('')

  // Real on-chain history pulled via RPC. Refreshes when address changes.
  const { items: allActivity, loading, error, refresh } = useRecentTransactions(address, 30)

  const filtered = useMemo(() => {
    return allActivity
      .filter(a => {
        if (filter === 'all')   return true
        if (filter === 'vault') return a.kind.startsWith('vault')
        if (filter === 'stake') return a.kind === 'stake' || a.kind === 'unstake'
        return a.kind === filter
      })
      .filter(a =>
        !query ||
        a.title.toLowerCase().includes(query.toLowerCase()) ||
        a.subtitle.toLowerCase().includes(query.toLowerCase()),
      )
  }, [allActivity, filter, query])

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
      <ScreenHeader
        title="Activity"
        subtitle={
          loading
            ? 'Loading on-chain history…'
            : `${allActivity.length} ${allActivity.length === 1 ? 'event' : 'events'}`
        }
        showBack={false}
        rightSlot={
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh"
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:text-text-primary transition-colors',
              loading && 'opacity-50 cursor-not-allowed',
            )}
            style={{ background: 'var(--surface-2)' }}
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RotateCw className="h-4 w-4" />}
          </button>
        }
      />

      <div className="p-4 space-y-3">
        {error && (
          <div className="flex items-start gap-2 rounded-2xl border p-3 text-xs text-danger"
            style={{ background: 'rgba(255,59,63,0.06)', borderColor: 'rgba(255,59,63,0.18)' }}>
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="flex-1 break-all">{error}</span>
            <button type="button" onClick={refresh} className="text-danger underline shrink-0">Retry</button>
          </div>
        )}

        <div className="flex items-center gap-2 rounded-2xl border px-3 py-2.5"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
          <Search className="h-4 w-4 shrink-0 text-text-muted" />
          <input
            type="text"
            placeholder="Search activity"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none placeholder:text-text-muted text-text-primary text-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto helio-scrollbar -mx-4 px-4 pb-1">
          {FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors border',
                filter === f.id
                  ? 'bg-accent-primary text-accent-primary-foreground border-transparent'
                  : 'text-text-secondary hover:text-text-primary',
              )}
              style={{
                background: filter === f.id ? undefined : 'var(--surface-2)',
                borderColor: filter === f.id ? 'transparent' : 'var(--border-subtle)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {grouped.length === 0 ? (
          loading && allActivity.length === 0 ? (
            <div className="rounded-3xl helio-card p-10 flex flex-col items-center gap-2 text-center">
              <Loader2 className="h-5 w-5 text-text-muted animate-spin" />
              <div className="text-text-muted text-sm">Fetching on-chain history…</div>
              <div className="text-text-muted text-[11px]">Pulling recent signatures from the cluster.</div>
            </div>
          ) : allActivity.length === 0 ? (
            <EmptyState
              eyebrow="Awaiting first signal"
              figure="00.0000"
              figureUnit="SOL"
              headline="No on-chain activity yet."
              body={<>Send or receive SOL, or set up the Vault to start round-up savings. Every transaction will surface here, indexed by day.</>}
              primary={{ label: 'Send SOL',    icon: ArrowUpRight,  onClick: () => navigate('/send') }}
              secondary={{ label: 'Receive',   icon: ArrowDownLeft, onClick: () => navigate('/receive') }}
            />
          ) : (
            <EmptyState
              eyebrow={`${filter === 'all' ? 'No match' : `Filter · ${filter}`}`}
              figure="—"
              headline={query ? `Nothing matches "${query}".` : 'Nothing in this view.'}
              body={query
                ? 'Try a different query or reset the filters.'
                : `No ${filter === 'all' ? 'transactions' : filter + ' activity'} found for this wallet yet.`}
              primary={{ label: 'Reset filters', icon: RotateCw, onClick: () => { setFilter('all'); setQuery('') } }}
              density="compact"
            />
          )
        ) : grouped.map(([day, items]) => (
          <div key={day} className="rounded-3xl helio-card p-2">
            <div className="px-3 py-2 font-eyebrow text-text-muted text-[10px]">{day}</div>
            <div className="space-y-0.5">
              {items.map(item => <ActivityRow key={item.id} item={item} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
