import React, { useRef, useState } from 'react'
import {
  ArrowUpRight, ArrowRight, Sparkles, Layers,
  Bell, RotateCw, AlertCircle, Eye, EyeOff, ChevronDown,
} from 'lucide-react'
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion'
import { useWallet } from '../contexts/WalletContext'
import { useRouter } from '../contexts/RouterContext'
import { cn } from '../lib/utils'
import { OrbitalPattern } from '../components/wallet/ui/OrbitalPattern'
import { TokenRow } from '../components/wallet/ui/TokenRow'
import { ActivityRow } from '../components/wallet/ui/ActivityRow'
import { WalletPillWithMenu } from '../components/wallet/ui/WalletMenu'
import { SectionEyebrow } from '../components/wallet/ui/SectionEyebrow'
import { FadeUp } from '../components/wallet/ui/FadeUp'
import { EmptyState } from '../components/wallet/ui/EmptyState'
import { useCountUp } from '../lib/use-count-up'
import { useRecentTransactions } from '../lib/transaction-history'
import {
  DepositGlyph, SendGlyph, SwapGlyph, StakeGlyph, VaultGlyph,
} from '../components/wallet/glyphs'

type Tab = 'tokens' | 'vault' | 'staking'

type AccentKey = 'lime' | 'blue' | 'red' | null

const QUICK_ACTIONS: {
  label: string
  index: string
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>
  path: string
  primary: boolean
  accent: AccentKey
}[] = [
  { label: 'Deposit', index: '01', icon: DepositGlyph, path: '/receive', primary: false, accent: 'lime' },
  { label: 'Swap',    index: '02', icon: SwapGlyph,    path: '/swap',    primary: false, accent: 'blue' },
  { label: 'Stake',   index: '03', icon: StakeGlyph,   path: '/staking', primary: false, accent: 'blue' },
  { label: 'Send',    index: '04', icon: SendGlyph,    path: '/send',    primary: true,  accent: null  },
]

const ACCENT_WELL: Record<Exclude<AccentKey, null>, { bg: string; color: string }> = {
  lime: { bg: 'rgba(198,240,0,0.10)', color: 'var(--accent-primary)' },
  blue: { bg: 'rgba(26,31,184,0.18)', color: '#7B82FF' },
  red:  { bg: 'rgba(255,59,63,0.10)', color: 'var(--danger)' },
}

function fmtDate(unix: number): string {
  if (!unix) return ''
  return new Date(unix * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function HomeScreen() {
  const { totalBalanceUsd, tokens, vault, loading, error, refresh, address } = useWallet()
  const { items: recentActivity } = useRecentTransactions(address, 5)
  const { navigate } = useRouter()
  const [tab, setTab] = useState<Tab>('tokens')
  const [dismissed, setDismissed] = useState(false)
  const [hidden, setHidden] = useState(false)

  // Animated balance counter — interpolates whenever totalBalanceUsd changes.
  const animatedBalance = useCountUp(totalBalanceUsd, 900)

  // Scroll-linked parallax for the orbital pattern.
  const reduce = useReducedMotion()
  const scrollRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: scrollRef,
    offset: ['start start', 'end start'],
  })
  // Subtle drift — orbital ring shifts up to 40 px down as you scroll past the hero.
  const orbitY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 40])

  const progress = vault.threshold > 0
    ? Math.min(Math.round((vault.balance / vault.threshold) * 100), 100)
    : 0
  const solToken = tokens.find((t) => t.id === 'sol')

  // Synthetic 24h delta — wire to real price history later
  const deltaPct = 1.86
  const deltaUsd = totalBalanceUsd * (deltaPct / 100)
  const deltaPositive = deltaPct >= 0

  return (
    <div ref={scrollRef} className="space-y-3 p-4">
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-xs text-danger"
          style={{ background: 'rgba(255,59,63,0.06)', borderColor: 'rgba(255,59,63,0.18)' }}>
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 truncate">{error}</span>
          <button type="button" onClick={refresh} className="text-danger underline shrink-0">Retry</button>
        </div>
      )}

      {/* Notification banner */}
      {!dismissed && (
        <div className="flex items-center gap-3 rounded-2xl border px-4 py-3"
          style={{ background: 'rgba(198,240,0,0.06)', borderColor: 'rgba(198,240,0,0.18)' }}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-accent-primary"
            style={{ background: 'rgba(198,240,0,0.12)' }}>
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

      {/* HERO — wallet pill, balance, delta, quick actions, vault status */}
      <FadeUp className="relative overflow-hidden rounded-3xl helio-card helio-noise p-5">
        {/* Atmospheric glow + orbital decoration layered behind content */}
        <div className="pointer-events-none absolute inset-0 helio-orbit-bg" />
        <motion.div
          style={{ y: orbitY }}
          className="pointer-events-none absolute -right-20 -top-20 h-[360px] w-[360px]"
        >
          <OrbitalPattern className="h-full w-full opacity-70" />
        </motion.div>

        {/* Top row: wallet menu + visibility */}
        <div className="relative z-20 flex items-center justify-between mb-5">
          <WalletPillWithMenu />
          <div className="flex items-center gap-1">
            <button type="button" onClick={refresh} disabled={loading}
              aria-label="Refresh"
              className={cn('flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:text-text-primary transition-colors',
                loading && 'opacity-50 cursor-not-allowed')}>
              <RotateCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
            <button type="button" onClick={() => setHidden(v => !v)}
              aria-label={hidden ? 'Show balance' : 'Hide balance'}
              className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:text-text-primary transition-colors">
              {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Balance */}
        <div className="relative z-10 mb-5">
          <p className="font-eyebrow text-text-muted text-[10px] mb-1.5">Total Balance</p>
          <div className="flex items-end gap-2">
            <h2 className="font-figure text-[48px] leading-[0.95] font-extrabold text-text-primary tabular-nums">
              {hidden
                ? '$••••••'
                : `$${animatedBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </h2>
            <button type="button"
              className="mb-1.5 flex items-center gap-0.5 text-text-muted text-sm hover:text-text-primary transition-colors">
              USD <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          {/* Delta */}
          <div className="mt-2.5 flex items-center gap-2">
            <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold',
              deltaPositive ? 'text-accent-primary' : 'text-danger')}
              style={{
                background: deltaPositive ? 'rgba(198,240,0,0.10)' : 'rgba(255,59,63,0.10)',
                borderColor:  deltaPositive ? 'rgba(198,240,0,0.22)' : 'rgba(255,59,63,0.22)',
              }}>
              {deltaPositive ? '+' : ''}{deltaPct.toFixed(2)}%
            </span>
            <span className="font-mono text-text-muted text-xs">
              {deltaPositive ? '+' : '−'}${Math.abs(deltaUsd).toFixed(2)} today
            </span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="relative z-10 grid grid-cols-4 gap-2">
          {QUICK_ACTIONS.map(({ label, index, icon: Icon, path, primary, accent }) => {
            const well = accent ? ACCENT_WELL[accent] : null
            return (
              <button
                key={label}
                type="button"
                onClick={() => navigate(path)}
                className={cn(
                  'group relative flex flex-col items-center justify-center gap-2 rounded-2xl border py-3.5 transition-all',
                  primary
                    ? 'border-transparent shadow-[0_8px_24px_-8px_rgba(198,240,0,0.45)] hover:brightness-105'
                    : 'hover:bg-surface-3',
                )}
                style={primary
                  ? { background: 'var(--accent-primary)' }
                  : { background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
              >
                {/* Tiny index marker — top-left, editorial flavour */}
                <span
                  className="absolute top-1.5 left-2 font-mono text-[8px] tracking-widest opacity-60"
                  style={{ color: primary ? 'rgba(0,0,0,0.55)' : 'var(--text-muted)' }}
                >
                  {index}
                </span>

                <span
                  className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors"
                  style={
                    primary
                      ? { background: 'rgba(0,0,0,0.18)', color: 'var(--accent-primary-foreground)' }
                      : { background: well!.bg, color: well!.color }
                  }
                >
                  <Icon size={18} strokeWidth={1.6} />
                </span>
                <span className={cn('text-xs font-medium',
                  primary ? 'text-accent-primary-foreground' : 'text-text-primary')}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Vault status pill */}
        <button type="button" onClick={() => navigate('/vault')}
          className="relative z-10 mt-3 flex w-full items-center gap-2 rounded-full border px-3 py-2 text-left transition-colors hover:bg-surface-3"
          style={{ background: 'rgba(198,240,0,0.07)', borderColor: 'rgba(198,240,0,0.18)' }}>
          <span className="text-accent-primary shrink-0"><VaultGlyph size={14} strokeWidth={1.8} /></span>
          <span className="flex-1 text-xs text-text-primary truncate">
            {vault.initialized
              ? <>Vault is <span className="text-accent-primary font-semibold">{vault.isActive ? 'accumulating' : 'paused'}</span> — <span className="text-accent-primary font-semibold">{progress}%</span> to next auto-stake</>
              : <>Vault not set up — <span className="text-accent-primary font-semibold">activate auto-yield</span></>
            }
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-text-muted shrink-0" />
        </button>
      </FadeUp>

      {/* PORTFOLIO section — eyebrow + dense tabs + edge-to-edge content */}
      <FadeUp delay={0.12}>
        <SectionEyebrow
          index="01"
          title={tab === 'tokens' ? 'Portfolio' : tab === 'vault' ? 'Vault' : 'Staking'}
          count={tab === 'tokens' ? `${tokens.length} assets` : undefined}
          action={
            <div className="flex items-center gap-0.5 rounded-full p-0.5"
              style={{ background: 'var(--surface-2)' }}>
              {(['tokens', 'vault', 'staking'] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors',
                    tab === t ? 'text-text-primary' : 'text-text-muted hover:text-text-primary',
                  )}
                  style={tab === t ? { background: 'var(--surface-4)' } : {}}
                >
                  {t}
                </button>
              ))}
            </div>
          }
        />
      </FadeUp>

      {/* Tab: Tokens — edge-to-edge list with hairline dividers */}
      {tab === 'tokens' && (
        <FadeUp delay={0.18} className="-mx-1 divide-y" key="tokens">
          {tokens.map((token, i) => (
            <div key={token.id} className={cn(i > 0 && 'border-t')}
              style={i > 0 ? { borderColor: 'var(--border-subtle)' } : {}}>
              <TokenRow
                token={{
                  symbol:    token.symbol,
                  name:      token.name,
                  balance:   token.balance,
                  price:     token.price,
                  change24h: token.change24h,
                  iconUrl:   token.iconUrl,
                }}
                hideBalance={hidden}
              />
            </div>
          ))}
          <div className="border-t pt-1.5 mt-1" style={{ borderColor: 'var(--border-subtle)' }}>
            <button type="button"
              className="flex w-full items-center justify-center gap-1 rounded-full py-2 text-xs text-text-muted hover:text-text-primary">
              See all tokens <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </FadeUp>
      )}

      {/* Tab: Vault */}
      {tab === 'vault' && (
        <div className="rounded-2xl helio-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-accent-primary" />
            <span className="text-text-primary font-semibold">Vault overview</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Balance',  value: `${vault.balance.toFixed(3)} SOL`, accent: true },
              { label: 'Est. APY', value: vault.isActive ? '7.1%' : 'Inactive', accent: vault.isActive },
              { label: 'Deployed', value: `${vault.deployed.toFixed(2)} SOL` },
              { label: 'Rewards',  value: `+${vault.rewards.toFixed(3)} SOL` },
            ].map(({ label, value, accent }) => (
              <div key={label} className="rounded-xl border p-3"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
                <div className="text-text-muted text-[11px] uppercase tracking-wider">{label}</div>
                <div className={cn('mt-1 text-lg font-semibold font-heading', accent ? 'text-accent-primary' : 'text-text-primary')}>
                  {value}
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => navigate('/vault')}
            className="mt-4 w-full rounded-full bg-accent-primary py-2.5 text-sm font-semibold text-accent-primary-foreground hover:bg-accent-primary-hover transition-colors">
            Manage vault
          </button>
        </div>
      )}

      {/* Tab: Staking — coming soon */}
      {tab === 'staking' && (
        <div className="rounded-2xl helio-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-accent-primary" />
            <span className="text-text-primary font-semibold">Staking</span>
            <span className="font-eyebrow text-text-muted text-[10px] inline-flex items-center gap-1.5 ml-1">
              <span className="h-1 w-1 rounded-full bg-warning" />
              Coming soon
            </span>
          </div>
          <div className="flex items-baseline gap-2 leading-none">
            <span className="font-figure text-[40px] font-extrabold text-text-primary/30 tabular-nums tracking-tighter select-none">
              00.00
            </span>
            <span className="font-figure text-text-muted text-sm font-bold tabular-nums">% APY</span>
          </div>
          <p className="text-text-muted text-xs mt-2 leading-relaxed max-w-[36ch]">
            Native validator delegation and liquid staking land soon. In the meantime your Vault still accumulates round-ups on every send.
          </p>
          <button type="button" onClick={() => navigate('/vault')}
            className="mt-4 w-full rounded-full bg-accent-primary py-2.5 text-sm font-semibold text-accent-primary-foreground hover:bg-accent-primary-hover transition-colors">
            Open Vault
          </button>
        </div>
      )}

      {/* Recent activity — slim, low-chrome, edge-to-edge */}
      <FadeUp delay={0.24}>
        <SectionEyebrow
          index="02"
          title="Recent activity"
          count={recentActivity.length > 0 ? recentActivity.length : undefined}
          action={
            <button type="button" onClick={() => navigate('/activity')}
              className="inline-flex items-center gap-0.5 text-text-muted text-[11px] hover:text-text-primary">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          }
        />
      </FadeUp>
      <FadeUp delay={0.3}>
        {recentActivity.length === 0 ? (
          <EmptyState
            density="compact"
            eyebrow="Dormant · no signal"
            figure="—"
            headline="Your first move starts here."
            body="Every send, swap, and vault round-up will appear in this feed."
            primary={{ label: 'Send SOL', icon: ArrowUpRight, onClick: () => navigate('/send') }}
            secondary={{ label: 'Open vault', onClick: () => navigate('/vault') }}
          />
        ) : (
          <div className="-mx-1 border-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {recentActivity.map((item, i) => (
              <div key={item.id} className={cn(i > 0 && 'border-t')}
                style={i > 0 ? { borderColor: 'var(--border-subtle)' } : {}}>
                <ActivityRow item={item} compact />
              </div>
            ))}
          </div>
        )}
      </FadeUp>
    </div>
  )
}
