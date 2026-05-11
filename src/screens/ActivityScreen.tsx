import React, { useMemo, useState } from 'react'
import { Search, ArrowDownLeft, ArrowUpRight, RotateCw } from 'lucide-react'
import { useWallet } from '../contexts/WalletContext'
import { useRouter } from '../contexts/RouterContext'
import { cn } from '../lib/utils'
import { ScreenHeader } from '../components/wallet/ui/ScreenHeader'
import { ActivityRow, type ActivityItem } from '../components/wallet/ui/ActivityRow'
import { EmptyState } from '../components/wallet/ui/EmptyState'

const FILTERS = [
  { id: 'all',     label: 'All' },
  { id: 'send',    label: 'Sent' },
  { id: 'receive', label: 'Received' },
  { id: 'swap',    label: 'Swaps' },
  { id: 'vault',   label: 'Vault' },
  { id: 'stake',   label: 'Staking' },
] as const

type FilterId = (typeof FILTERS)[number]['id']

/** Derive activity from on-chain vault state. */
function buildVaultActivity(vault: ReturnType<typeof useWallet>['vault']): ActivityItem[] {
  const out: ActivityItem[] = []

  if (vault.lastSweepAt > 0) {
    out.push({
      id: 'vault-sweep',
      kind: 'vault-roundup',
      title: 'Vault round-up',
      subtitle: `${vault.balance.toFixed(4)} SOL in reserve`,
      amount: `+${vault.balance.toFixed(4)} SOL`,
      positive: true,
      date: new Date(vault.lastSweepAt * 1000).toISOString(),
    })
  }

  if (vault.lastWithdrawAt > 0) {
    out.push({
      id: 'vault-withdraw',
      kind: 'vault-withdraw',
      title: 'Vault withdrawal',
      subtitle: 'Withdrawn from reserve',
      amount: '— SOL',
      positive: false,
      date: new Date(vault.lastWithdrawAt * 1000).toISOString(),
    })
  }

  if (vault.rewards > 0) {
    out.push({
      id: 'vault-reward',
      kind: 'vault-reward',
      title: 'Validator rewards',
      subtitle: `From ${vault.strategy}`,
      amount: `+${vault.rewards.toFixed(4)} SOL`,
      positive: true,
      date: new Date(Math.max(vault.lastSweepAt, Date.now() / 1000) * 1000).toISOString(),
    })
  }

  return out
}

export function ActivityScreen() {
  const { vault } = useWallet()
  const { navigate } = useRouter()
  const [filter, setFilter] = useState<FilterId>('all')
  const [query,  setQuery]  = useState('')

  const allActivity = useMemo(() => buildVaultActivity(vault), [vault])

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
        subtitle={`${allActivity.length} ${allActivity.length === 1 ? 'event' : 'events'}`}
        showBack={false}
      />

      <div className="p-4 space-y-3">
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
          allActivity.length === 0 ? (
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
