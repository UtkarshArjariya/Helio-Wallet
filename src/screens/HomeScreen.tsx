import React, { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Repeat, Layers, TrendingUp, Sparkles, Bell } from 'lucide-react'
import { useWallet } from '../contexts/WalletContext'
import { useRouter } from '../contexts/RouterContext'
import { cn } from '../lib/utils'

type Tab = 'tokens' | 'vault' | 'staking' | 'earn'

export function HomeScreen() {
  const { totalBalanceUsd, tokens, vault } = useWallet()
  const { navigate } = useRouter()
  const [tab, setTab] = useState<Tab>('tokens')
  const [dismissed, setDismissed] = useState(false)
  const progress = Math.round((vault.balance / vault.threshold) * 100)

  return (
    <div className="space-y-3 p-4">
      {/* Notification banner */}
      {!dismissed && (
        <div className="flex items-center gap-3 rounded-2xl border px-4 py-3"
          style={{ background: 'rgba(198,240,0,0.06)', borderColor: 'rgba(198,240,0,0.18)' }}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-accent-primary" style={{ background: 'rgba(198,240,0,0.12)' }}>
            <Bell className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-text-primary text-sm font-medium">Enable wallet alerts</div>
            <div className="text-text-muted text-xs">Get notified for deposits, thresholds, and rewards.</div>
          </div>
          <button type="button" onClick={() => setDismissed(true)}
            className="rounded-full bg-accent-primary px-3 py-1.5 text-xs font-semibold text-accent-primary-foreground hover:bg-accent-primary-hover transition-colors shrink-0">
            Enable
          </button>
        </div>
      )}

      {/* Balance card */}
      <div className="rounded-3xl helio-card helio-noise p-5 text-center">
        <p className="text-text-muted text-xs uppercase tracking-widest mb-1">Total Balance</p>
        <h2 className="font-heading text-4xl font-bold text-text-primary" style={{ letterSpacing: '-0.03em' }}>
          ${totalBalanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </h2>
        <div className="inline-flex items-center gap-1 mt-2 rounded-full px-3 py-1 text-xs font-medium text-success" style={{ background: 'rgba(198,240,0,0.1)' }}>
          <ArrowUpRight className="h-3 w-3" />+2.4% today
        </div>
        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Deposit', icon: ArrowDownLeft, path: '/receive' },
            { label: 'Send',    icon: ArrowUpRight,  path: '/send' },
            { label: 'Swap',    icon: Repeat,        path: '/swap' },
            { label: 'Stake',   icon: Layers,        path: '/staking' },
          ].map(({ label, icon: Icon, path }) => (
            <button key={label} type="button" onClick={() => navigate(path)} className="flex flex-col items-center gap-2 group">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-text-secondary group-hover:bg-accent-primary group-hover:text-accent-primary-foreground transition-all"
                style={{ background: 'var(--surface-3)' }}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-[11px] font-medium text-text-muted group-hover:text-text-primary transition-colors">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Vault promo */}
      <button type="button" onClick={() => navigate('/vault')}
        className="flex w-full items-center gap-3 rounded-2xl helio-card helio-noise p-3 text-left hover:bg-surface-3 transition-colors">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl helio-gradient-solar text-accent-primary-foreground">
          <TrendingUp className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-accent-primary helio-pulse-ring" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-text-primary font-semibold text-sm">Vault: {progress}% to next auto-stake</div>
          <div className="text-text-muted text-xs">Est. 7.1% APY · Helio Validator</div>
        </div>
        <ArrowRight className="h-4 w-4 text-text-muted" />
      </button>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-full p-1 border w-full"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}>
        {(['tokens', 'vault', 'staking', 'earn'] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={cn('flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors capitalize',
              tab === t ? 'text-text-primary' : 'text-text-muted hover:text-text-primary')}
            style={tab === t ? { background: 'var(--surface-3)' } : {}}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'tokens' && (
        <div className="rounded-2xl helio-card p-1.5">
          {tokens.map((token) => (
            <div key={token.id} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-3 transition-colors cursor-pointer">
              <div className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm text-text-primary shrink-0"
                style={{ background: 'var(--surface-3)' }}>
                {token.symbol[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-text-primary text-sm font-medium">{token.name}</div>
                <div className="text-text-muted text-xs">{token.balance} {token.symbol}</div>
              </div>
              <div className="text-right">
                <div className="text-text-primary text-sm font-medium">
                  ${(token.balance * token.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className={cn('text-xs', token.change24h >= 0 ? 'text-success' : 'text-danger')}>
                  {token.change24h >= 0 ? '+' : ''}{token.change24h}%
                </div>
              </div>
            </div>
          ))}
          <button type="button" className="flex w-full items-center justify-center gap-1 rounded-xl py-2 text-xs text-text-muted hover:text-text-primary">
            See all tokens <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {tab === 'vault' && (
        <div className="rounded-2xl helio-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-accent-primary" />
            <span className="text-text-primary font-semibold">Vault overview</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Balance', value: `${vault.balance.toFixed(3)} SOL`, accent: true },
              { label: 'Est. APY', value: vault.isActive ? '7.1%' : 'Inactive', accent: vault.isActive },
              { label: 'Deployed', value: `${vault.deployed.toFixed(2)} SOL` },
              { label: 'Rewards', value: `+${vault.rewards.toFixed(3)} SOL` },
            ].map(({ label, value, accent }) => (
              <div key={label} className="rounded-xl border p-3" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
                <div className="text-text-muted text-[11px] uppercase tracking-wider">{label}</div>
                <div className={cn('mt-1 text-lg font-semibold font-heading', accent ? 'text-accent-primary' : 'text-text-primary')}>{value}</div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => navigate('/vault')}
            className="mt-4 w-full rounded-full bg-accent-primary py-2.5 text-sm font-semibold text-accent-primary-foreground hover:bg-accent-primary-hover transition-colors">
            Manage vault
          </button>
        </div>
      )}

      {tab === 'staking' && (
        <div className="rounded-2xl helio-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-accent-primary" />
            <span className="text-text-primary font-semibold">Staking summary</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Staked', value: '1.50 SOL', sub: '≈ $255.00' },
              { label: 'Est. APY', value: '7.1%', sub: 'Helio Validator', accent: true },
              { label: 'Rewards (30d)', value: '0.024 SOL', sub: '≈ $4.08' },
              { label: 'Validators', value: '1', sub: 'Active' },
            ].map(({ label, value, sub, accent }) => (
              <div key={label} className="rounded-xl border p-3" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
                <div className="text-text-muted text-[11px] uppercase tracking-wider">{label}</div>
                <div className={cn('mt-1 text-lg font-semibold font-heading', accent ? 'text-accent-primary' : 'text-text-primary')}>{value}</div>
                {sub && <div className="text-text-muted text-xs mt-0.5">{sub}</div>}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => navigate('/staking')}
            className="mt-4 w-full rounded-full bg-accent-primary py-2.5 text-sm font-semibold text-accent-primary-foreground hover:bg-accent-primary-hover transition-colors">
            Stake more SOL
          </button>
        </div>
      )}

      {tab === 'earn' && (
        <div className="rounded-2xl helio-card p-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl helio-gradient-cosmic text-white">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="text-text-primary font-semibold">Earn on your SOL</div>
          <div className="text-text-muted text-xs mt-1">Auto-deploy spare change into staking & yield strategies via the Vault.</div>
        </div>
      )}

      {/* Recent activity */}
      <div className="rounded-2xl helio-card p-3">
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="text-text-primary font-semibold text-sm">Recent activity</span>
          <button type="button" onClick={() => navigate('/activity')} className="text-text-muted text-xs hover:text-text-primary">See all</button>
        </div>
        <div className="space-y-1">
          {[
            { title: 'Vault Round-up', sub: 'Today, 2:30 PM', amount: '+0.012 SOL', positive: true },
            { title: 'Swap SOL → USDC', sub: 'Yesterday', amount: '+145.20 USDC', positive: true },
            { title: 'Sent SOL', sub: 'Apr 22', amount: '−0.25 SOL', positive: false },
          ].map((a, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-3 transition-colors cursor-pointer">
              <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                style={{ background: 'var(--surface-3)', color: a.positive ? 'var(--success)' : 'var(--danger)' }}>
                {a.positive ? '↑' : '↓'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-text-primary text-xs font-medium">{a.title}</div>
                <div className="text-text-muted text-[11px]">{a.sub}</div>
              </div>
              <div className={cn('text-xs font-medium', a.positive ? 'text-success' : 'text-text-primary')}>{a.amount}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
