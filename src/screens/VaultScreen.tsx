import React, { useState } from 'react'
import { Sparkles, Play, Pause, Copy, ExternalLink, TrendingUp, Layers } from 'lucide-react'
import { useWallet } from '../contexts/WalletContext'
import { Switch } from '../components/ui/switch'
import { cn } from '../lib/utils'

type Tab = 'overview' | 'rules' | 'strategy' | 'history'
type HistoryKind = 'sweep' | 'deploy' | 'reward'

const STRATEGIES: { id: string; name: string; apy: number; risk: string; lockup: string; desc: string }[] = [
  { id: 'helio',  name: 'Helio Validator',  apy: 7.1,  risk: 'Low',     lockup: 'None',   desc: 'Stake with the official Helio validator. Liquid, low-risk.' },
  { id: 'kamino', name: 'Kamino Finance',   apy: 12.3, risk: 'Medium',  lockup: '7 days', desc: 'Earn yield on SOL via Kamino lending markets.' },
  { id: 'jito',   name: 'Jito Restaking',   apy: 8.8,  risk: 'Low-Med', lockup: 'None',   desc: 'Liquid restaking via Jito for MEV-enhanced rewards.' },
]

const HISTORY: { type: HistoryKind; title: string; amount: string; date: string }[] = [
  { type: 'sweep',  title: 'Round-up swept',        amount: '+0.012 SOL', date: 'Today, 2:30 PM' },
  { type: 'deploy', title: 'Deployed to validator', amount: '0.10 SOL',  date: 'Apr 28, 10:01 AM' },
  { type: 'sweep',  title: 'Round-up swept',        amount: '+0.008 SOL', date: 'Apr 26, 4:15 PM' },
  { type: 'reward', title: 'Staking reward',        amount: '+0.004 SOL', date: 'Apr 25, 12:00 AM' },
]

const HISTORY_ICON: Record<HistoryKind, string> = { sweep: '↑', deploy: '→', reward: '★' }

export function VaultScreen() {
  const { vault, updateVault, updateVaultRule, tokens } = useWallet()
  const [tab, setTab] = useState<Tab>('overview')
  const [selectedStrategy, setSelectedStrategy] = useState(vault.strategy)

  const solPrice = tokens.find((t) => t.id === 'sol')?.price ?? 145.20
  const progress = Math.min(Math.round((vault.balance / vault.threshold) * 100), 100)

  const applyStrategy = (name: typeof vault.strategy) => {
    setSelectedStrategy(name)
    updateVault({ strategy: name })
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent-primary" />
          <span className="text-text-primary font-heading font-semibold">Helio Vault</span>
        </div>
        <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full',
          vault.isActive ? 'text-success' : 'text-warning')}
          style={{ background: vault.isActive ? 'rgba(198,240,0,0.1)' : 'rgba(255,184,77,0.1)' }}>
          {vault.isActive ? 'Accumulating' : 'Paused'}
        </span>
      </div>

      {/* Hero */}
      <div className="p-4">
        <div className="rounded-3xl helio-card helio-noise p-5 text-center">
          <p className="text-text-muted text-xs uppercase tracking-wider mb-1">Vault Balance</p>
          <h3 className="font-heading text-4xl font-bold text-accent-primary" style={{ letterSpacing: '-0.03em' }}>
            {vault.balance.toFixed(3)} SOL
          </h3>
          <p className="text-text-muted text-xs mt-1">≈ ${(vault.balance * solPrice).toFixed(2)}</p>

          <div className="mt-4 mb-2">
            <div className="flex justify-between text-xs text-text-muted mb-1.5">
              <span>{progress}% to threshold</span>
              <span>{vault.threshold.toFixed(2)} SOL</span>
            </div>
            <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
              <div className="h-full rounded-full bg-accent-primary transition-all duration-700" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { label: 'Deployed', value: `${vault.deployed.toFixed(2)} SOL` },
              { label: 'Rewards',  value: `+${vault.rewards.toFixed(3)} SOL`, accent: true },
              { label: 'Strategy', value: vault.strategy.split(' ')[0] },
            ].map(({ label, value, accent }) => (
              <div key={label} className="rounded-xl p-2.5" style={{ background: 'var(--surface-3)' }}>
                <div className="text-text-muted text-[10px] uppercase tracking-wider">{label}</div>
                <div className={cn('font-semibold text-sm mt-0.5', accent ? 'text-success' : 'text-text-primary')}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-4">
            <button type="button" onClick={() => updateVault({ isActive: !vault.isActive })}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border py-2.5 text-sm font-medium text-text-primary hover:bg-surface-3 transition-colors"
              style={{ borderColor: 'var(--border-subtle)' }}>
              {vault.isActive ? <><Pause className="h-4 w-4" />Pause</> : <><Play className="h-4 w-4" />Resume</>}
            </button>
            <button type="button"
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-accent-primary py-2.5 text-sm font-semibold text-accent-primary-foreground hover:bg-accent-primary-hover transition-colors">
              <TrendingUp className="h-4 w-4" />Add Funds
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pb-2">
        <div className="flex gap-1 rounded-full p-1 border"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}>
          {(['overview', 'rules', 'strategy', 'history'] as Tab[]).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={cn('flex-1 rounded-full px-2 py-1.5 text-xs font-medium transition-colors capitalize',
                tab === t ? 'text-text-primary' : 'text-text-muted hover:text-text-primary')}
              style={tab === t ? { background: 'var(--surface-3)' } : {}}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {tab === 'overview' && (
          <div className="rounded-2xl helio-card p-4">
            <p className="text-text-primary font-semibold text-sm mb-3">Vault details</p>
            {[
              { label: 'Auto-stake threshold', value: `${vault.threshold.toFixed(2)} SOL` },
              { label: 'Current strategy',     value: vault.strategy },
              { label: 'Status',               value: vault.isActive ? 'Accumulating' : 'Paused' },
              { label: 'Total deployed',        value: `${vault.deployed.toFixed(2)} SOL` },
              { label: 'Total rewards',         value: `+${vault.rewards.toFixed(3)} SOL` },
            ].map(({ label, value }, i, arr) => (
              <div key={label} className={cn('flex items-center justify-between py-2 text-sm', i < arr.length - 1 && 'border-b')}
                style={i < arr.length - 1 ? { borderColor: 'var(--border-subtle)' } : {}}>
                <span className="text-text-muted text-xs">{label}</span>
                <span className="text-text-primary font-medium text-xs">{value}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'rules' && (
          <div className="rounded-2xl helio-card p-4 space-y-3">
            <p className="text-text-primary font-semibold text-sm mb-1">Auto-save rules</p>
            {([
              { key: 'roundUpTransfers',   label: 'Round-up transfers',   sub: 'Sweep to nearest SOL unit on every send' },
              { key: 'roundUpSwaps',       label: 'Round-up swaps',       sub: 'Sweep spare change on every swap' },
              { key: 'percentageIncoming', label: '% of incoming',        sub: 'Auto-save a percentage of received SOL' },
            ] as { key: keyof typeof vault.rules; label: string; sub: string }[]).map(({ key, label, sub }) => (
              <div key={key} className="flex items-center justify-between rounded-xl border p-3"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
                <div className="min-w-0 mr-3">
                  <div className="text-text-primary text-sm font-medium">{label}</div>
                  <div className="text-text-muted text-xs">{sub}</div>
                </div>
                <Switch checked={vault.rules[key]} onCheckedChange={(v) => updateVaultRule(key, v)} />
              </div>
            ))}
          </div>
        )}

        {tab === 'strategy' && (
          <div className="space-y-2">
            {STRATEGIES.map((s) => {
              const active = selectedStrategy === s.name
              return (
                <button key={s.id} type="button" onClick={() => applyStrategy(s.name as typeof vault.strategy)}
                  className="flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors hover:bg-surface-3"
                  style={{
                    background: active ? 'var(--surface-3)' : 'var(--surface-2)',
                    borderColor: active ? 'var(--accent-primary)' : 'var(--border-subtle)',
                  }}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl helio-gradient-solar text-accent-primary-foreground mt-0.5">
                    <Layers className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-text-primary font-semibold text-sm">{s.name}</span>
                      <span className="text-success text-xs font-bold">{s.apy}%</span>
                    </div>
                    <p className="text-text-muted text-xs mt-0.5">{s.desc}</p>
                    <div className="flex gap-3 mt-1.5 text-[10px] text-text-muted">
                      <span>Risk: <span className="text-text-secondary">{s.risk}</span></span>
                      <span>Lockup: <span className="text-text-secondary">{s.lockup}</span></span>
                    </div>
                  </div>
                  {active && <span className="h-2.5 w-2.5 rounded-full bg-accent-primary shrink-0 mt-1" />}
                </button>
              )
            })}
          </div>
        )}

        {tab === 'history' && (
          <div className="rounded-2xl helio-card p-2">
            {HISTORY.map((h, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-3 transition-colors">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold shrink-0"
                  style={{ background: h.type === 'reward' ? 'rgba(198,240,0,0.1)' : 'var(--surface-3)', color: h.type === 'reward' ? 'var(--success)' : 'var(--text-secondary)' }}>
                  {HISTORY_ICON[h.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-text-primary text-sm font-medium">{h.title}</div>
                  <div className="text-text-muted text-xs">{h.date}</div>
                </div>
                <div className={cn('text-sm font-medium', h.type === 'reward' ? 'text-success' : 'text-text-secondary')}>
                  {h.amount}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* On-chain details */}
        <div className="rounded-2xl helio-card p-4">
          <p className="text-text-muted text-xs uppercase tracking-wider mb-3">On-chain details</p>
          {[
            { label: 'Vault PDA',      value: 'HeV1…9xP', copy: true },
            { label: 'Network',        value: 'Solana Mainnet' },
            { label: 'Last deployed',  value: '3 days ago' },
          ].map(({ label, value, copy }) => (
            <div key={label} className="flex items-center justify-between text-xs border-b py-2 last:border-0 last:py-0"
              style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="text-text-muted">{label}</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-text-primary">{value}</span>
                {copy && <>
                  <button type="button" aria-label="Copy address" className="text-text-muted hover:text-text-primary"><Copy className="h-3 w-3" /></button>
                  <button type="button" aria-label="View on explorer" className="text-text-muted hover:text-text-primary"><ExternalLink className="h-3 w-3" /></button>
                </>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
