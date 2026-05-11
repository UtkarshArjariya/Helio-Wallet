import React, { useState } from 'react'
import {
  AlertTriangle, ArrowDownToLine, ArrowUpRight, Check, ChevronDown, Clock,
  Copy, ExternalLink, Info, Loader2, Pause, Play, Plus, Sparkles,
  TrendingUp, Zap,
} from 'lucide-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useWallet } from '../contexts/WalletContext'
import { cn } from '../lib/utils'
import { ScreenHeader } from '../components/wallet/ui/ScreenHeader'
import { ProgressRing } from '../components/wallet/ui/ProgressRing'
import { VaultStatusPill, type VaultStatus } from '../components/wallet/ui/StatusPill'
import { OrbitalPattern } from '../components/wallet/ui/OrbitalPattern'
import { EmptyState } from '../components/wallet/ui/EmptyState'
import { VaultGlyph } from '../components/wallet/glyphs'

type Tab = 'overview' | 'rules' | 'strategy' | 'history'

const STRATEGIES = [
  {
    id: 'helio',  name: 'Helio Validator', type: 'Native Staking',  apy: 7.1,
    risk: 'Low' as const,    lockup: 'None',     fee: '5% of rewards',
    desc: 'Stake natively to the Helio-operated validator. Rewards auto-compound each epoch.',
  },
  {
    id: 'lst',    name: 'Liquid Staking',  type: 'LST',             apy: 8.0,
    risk: 'Medium' as const, lockup: 'None',     fee: '1% protocol fee',
    desc: 'Mint a liquid staking token that stays usable across DeFi while earning rewards.',
  },
  {
    id: 'stable', name: 'Stable Yield',    type: 'Yield Protocol',  apy: 9.2,
    risk: 'Medium' as const, lockup: '7 days',   fee: '10% performance',
    desc: 'Conservative delta-neutral strategy across vetted lending markets. APY varies with rates.',
  },
]

function fmtTs(unix: number): string {
  if (!unix) return '—'
  return new Date(unix * 1000).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function vaultStatusOf(initialized: boolean, isActive: boolean, balance: number, threshold: number): VaultStatus {
  if (!initialized)                       return 'inactive'
  if (!isActive)                          return 'paused'
  if (threshold > 0 && balance >= threshold) return 'threshold-reached'
  return 'accumulating'
}

export function VaultScreen() {
  const {
    vault, hasKeypair, tokens,
    initializeVault,
    pauseVault, resumeVault, updateVaultConfig,
    addFundsToVault, withdrawFromVault,
    updateVaultRule,
  } = useWallet()

  const [tab, setTab] = useState<Tab>('overview')
  const [selectedStrategy, setSelectedStrategy] = useState<string>(vault.strategy)
  const [thresholdMode, setThresholdMode] = useState<'auto' | 'notify' | 'manual'>('auto')

  const [pending, setPending]   = useState(false)
  const [txSig,   setTxSig]     = useState<string | null>(null)
  const [txError, setTxError]   = useState<string | null>(null)
  const [actionMode, setActionMode] = useState<'add' | 'withdraw'>('add')
  const [amount, setAmount] = useState('')

  const solToken = tokens.find(t => t.id === 'sol')
  const solPrice = solToken?.price ?? 145
  const status   = vaultStatusOf(vault.initialized, vault.isActive, vault.balance, vault.threshold)
  const progress = vault.threshold > 0 ? Math.min(vault.balance / vault.threshold, 1) : 0
  const progressPct = Math.round(progress * 100)

  async function run(label: string, fn: () => Promise<{ signature: string }>) {
    setPending(true); setTxError(null); setTxSig(null)
    try {
      const r = await fn()
      setTxSig(r.signature)
    } catch (e: any) {
      setTxError(e?.message ?? `${label} failed.`)
    } finally {
      setPending(false)
    }
  }

  const handlePauseResume = () =>
    run(vault.isActive ? 'Pause' : 'Resume',
      vault.isActive ? pauseVault : resumeVault)

  const handleSetup = () => run('Set up vault', initializeVault)

  const lamports = Math.floor((parseFloat(amount) || 0) * LAMPORTS_PER_SOL)
  const canSubmit = lamports > 0 && hasKeypair && !pending

  const handleSubmit = () => {
    if (!canSubmit) return
    const op = actionMode === 'add'
      ? { label: 'Add funds', fn: () => addFundsToVault(lamports) }
      : { label: 'Withdraw',  fn: () => withdrawFromVault(lamports) }
    run(op.label, op.fn).then(() => setAmount(''))
  }

  const handleRuleToggle = async (key: keyof typeof vault.rules, value: boolean) => {
    updateVaultRule(key, value)
    if (!vault.initialized || !hasKeypair) return
    const sweepMode = key === 'percentageIncoming' ? (value ? 1 : 0) :
                      key === 'roundUpTransfers'    ? (value ? 0 : 1) : 0
    try {
      await updateVaultConfig({
        enabled: vault.isActive, sweepMode,
        percentageBps: 100, roundUpUnitLamports: 10_000_000,
        deployThresholdAtomic: Math.round(vault.threshold * LAMPORTS_PER_SOL),
      })
    } catch { updateVaultRule(key, !value) }
  }

  const solscan = (sig: string) =>
    window.open(`https://solscan.io/tx/${sig}`, '_blank', 'noopener,noreferrer')

  return (
    <div className="flex flex-col pb-32">
      <ScreenHeader
        title="Helio Vault"
        subtitle="Round-up savings · auto-deployed"
        rightSlot={vault.initialized ? <VaultStatusPill status={status} size="sm" /> : null}
      />

      {/* Feedback banners */}
      {txSig && (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border p-3"
          style={{ background: 'rgba(198,240,0,0.06)', borderColor: 'rgba(198,240,0,0.18)' }}>
          <Check className="h-4 w-4 text-success shrink-0" />
          <span className="text-text-primary text-xs flex-1">Transaction confirmed</span>
          <button type="button" onClick={() => solscan(txSig)}
            className="text-accent-primary text-[11px] hover:underline shrink-0">View ↗</button>
          <button type="button" onClick={() => setTxSig(null)} className="text-text-muted text-xs">✕</button>
        </div>
      )}
      {txError && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-2xl border p-3 text-xs text-danger"
          style={{ background: 'rgba(255,59,63,0.06)', borderColor: 'rgba(255,59,63,0.18)' }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="flex-1 break-all">{txError}</span>
          <button type="button" onClick={() => setTxError(null)} className="text-danger shrink-0">✕</button>
        </div>
      )}

      {/* Empty state */}
      {!vault.initialized && (
        <div className="p-4">
          <VaultEmptyState
            pdaAddress={vault.pdaAddress}
            onSetup={handleSetup}
            pending={pending}
            disabled={!hasKeypair || pending}
          />
        </div>
      )}

      {/* Initialized: Hero + Tabs */}
      {vault.initialized && (
        <>
          <div className="px-4 pt-4">
            <VaultHero
              balance={vault.balance}
              threshold={vault.threshold}
              progress={progress}
              progressPct={progressPct}
              solPrice={solPrice}
              status={status}
              rewards={vault.rewards}
              deployed={vault.deployed}
            />
          </div>

          <div className="px-4 pt-3">
            <SegmentedControl tab={tab} onChange={setTab} />
          </div>

          <div className="p-4 space-y-3">
            {tab === 'overview' && (
              <>
                <ForecastCard balance={vault.balance} solPrice={solPrice} />
                <PdaDetailsCard pda={vault.pdaAddress} strategy={vault.strategy}
                  lastSweep={vault.lastSweepAt} lastWithdraw={vault.lastWithdrawAt} />
              </>
            )}

            {tab === 'rules' && (
              <RulesCard
                rules={vault.rules}
                onToggle={handleRuleToggle}
                threshold={vault.threshold}
                thresholdMode={thresholdMode}
                onThresholdModeChange={setThresholdMode}
              />
            )}

            {tab === 'strategy' && (
              <StrategyList
                selected={selectedStrategy}
                onSelect={setSelectedStrategy}
              />
            )}

            {tab === 'history' && (
              <VaultHistory
                lastSweep={vault.lastSweepAt}
                lastWithdraw={vault.lastWithdrawAt}
                balance={vault.balance}
                rewards={vault.rewards}
              />
            )}
          </div>
        </>
      )}

      {/* Floating bottom action bar — one tabbed amount input, mode toggle + pause */}
      {vault.initialized && (
        <div className="sticky bottom-16 px-4 pb-3 pt-2 border-t backdrop-blur-md"
          style={{
            background: 'color-mix(in oklab, var(--bg) 85%, transparent)',
            borderColor: 'var(--border-subtle)',
          }}>
          {/* Mode tabs */}
          <div className="mb-2 flex items-center gap-1 rounded-full p-0.5"
            style={{ background: 'var(--surface-2)' }}>
            {(['add', 'withdraw'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setActionMode(m)}
                className={cn(
                  'flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors capitalize',
                  actionMode === m ? 'text-text-primary' : 'text-text-muted hover:text-text-primary',
                )}
                style={actionMode === m ? { background: 'var(--surface-4)' } : {}}
              >
                {m === 'add' ? <Plus className="h-3 w-3" /> : <ArrowDownToLine className="h-3 w-3" />}
                {m === 'add' ? 'Add funds' : 'Withdraw'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number" inputMode="decimal"
              placeholder={actionMode === 'add' ? 'Amount to deposit' : 'Amount to withdraw'}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min="0" step="0.001"
              className="flex-1 rounded-full border px-4 py-2.5 text-sm font-mono text-text-primary outline-none placeholder:text-text-muted bg-transparent"
              style={{ borderColor: 'var(--border-subtle)' }}
            />
            <button
              type="button" onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors shrink-0',
                !canSubmit
                  ? 'text-text-muted cursor-not-allowed'
                  : actionMode === 'add'
                    ? 'bg-accent-primary text-accent-primary-foreground hover:bg-accent-primary-hover'
                    : 'border text-text-primary hover:bg-surface-3',
              )}
              style={
                !canSubmit ? { background: 'var(--surface-3)' }
                : actionMode === 'withdraw' ? { background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }
                : {}
              }
            >
              {pending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : actionMode === 'add' ? <Plus className="h-4 w-4" /> : <ArrowDownToLine className="h-4 w-4" />}
              {actionMode === 'add' ? 'Deposit' : 'Withdraw'}
            </button>
            <button
              type="button" onClick={handlePauseResume}
              disabled={pending || !hasKeypair}
              aria-label={vault.isActive ? 'Pause vault' : 'Resume vault'}
              title={vault.isActive ? 'Pause vault' : 'Resume vault'}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full border transition-colors shrink-0',
                pending || !hasKeypair ? 'text-text-muted cursor-not-allowed' : 'text-text-primary hover:bg-surface-3',
              )}
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-2)' }}
            >
              {pending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : vault.isActive
                  ? <Pause className="h-4 w-4" />
                  : <Play className="h-4 w-4" />}
            </button>
          </div>

          {!hasKeypair && (
            <p className="text-text-muted text-[11px] mt-2 text-center">Import your wallet to sign transactions.</p>
          )}
        </div>
      )}
    </div>
  )
}

/* ----------------------------- HERO ----------------------------- */

function VaultHero({
  balance, threshold, progress, progressPct, solPrice, status, rewards, deployed,
}: {
  balance: number; threshold: number; progress: number; progressPct: number
  solPrice: number; status: VaultStatus; rewards: number; deployed: number
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl helio-card helio-noise p-5" style={{ isolation: 'isolate' }}>
      <div className="pointer-events-none absolute inset-0 helio-orbit-bg" style={{ zIndex: -1 }} />
      {/* Royal-blue glow anchors the vault as the YIELD surface */}
      <div className="pointer-events-none absolute -left-16 -bottom-16 h-56 w-56 rounded-full"
        style={{ background: 'rgba(26,31,184,0.22)', filter: 'blur(60px)', zIndex: -1 }} />
      <OrbitalPattern className="pointer-events-none absolute -right-16 -top-16 h-[320px] w-[320px] opacity-60" style={{ zIndex: -1 }} />

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl helio-gradient-cosmic text-white">
            <VaultGlyph size={20} strokeWidth={1.7} />
          </span>
          <div>
            <div className="font-heading text-lg font-bold text-text-primary">Helio Vault</div>
            <div className="text-text-muted text-xs">Round-up savings · auto-deployed</div>
          </div>
        </div>
        <VaultStatusPill status={status} size="sm" />
      </div>

      <div className="relative mt-5 flex items-center gap-5">
        <ProgressRing
          value={progress}
          size={132}
          strokeWidth={12}
          label={
            <div className="flex flex-col items-center">
              <span className="font-figure text-2xl font-bold leading-none">{balance.toFixed(3)}</span>
              <span className="text-text-muted text-[10px] mt-1">SOL</span>
            </div>
          }
          sublabel={<span className="font-mono text-[10px]">{progressPct}% to threshold</span>}
        />

        <div className="flex-1 space-y-2">
          <div>
            <div className="font-eyebrow text-text-muted text-[10px]">Threshold</div>
            <div className="text-text-primary font-heading text-base font-semibold font-mono">
              {threshold.toFixed(3)} SOL
            </div>
            <div className="text-text-muted text-xs font-mono">
              ≈ ${(threshold * solPrice).toFixed(2)}
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-success/10 border border-success/20 px-2.5 py-1 w-fit">
            <TrendingUp className="h-3 w-3 text-success" />
            <span className="text-success text-xs font-medium">Est. 7.1% APY</span>
          </div>
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-3 gap-2">
        <HeroStat label="Deployed" value={`${deployed.toFixed(2)} SOL`} sub={`≈ $${(deployed * solPrice).toFixed(2)}`} />
        <HeroStat label="Rewards"  value={`+${rewards.toFixed(3)} SOL`} sub="Lifetime" accent />
        <HeroStat label="Balance"  value={`$${(balance * solPrice).toFixed(2)}`} sub="USD" />
      </div>
    </div>
  )
}

function HeroStat({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border p-3"
      style={{ background: 'color-mix(in oklab, var(--surface-2) 80%, transparent)', borderColor: 'var(--border-subtle)' }}>
      <div className="font-eyebrow text-text-muted text-[9px]">{label}</div>
      <div className={cn(
        'mt-1 font-heading text-sm font-semibold font-mono truncate',
        accent ? 'text-accent-primary' : 'text-text-primary',
      )}>
        {value}
      </div>
      {sub && <div className="text-text-muted text-[10px] mt-0.5 font-mono">{sub}</div>}
    </div>
  )
}

/* --------------------------- SEGMENTED -------------------------- */

function SegmentedControl({
  tab, onChange,
}: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full p-1 border w-full"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}>
      {(['overview', 'rules', 'strategy', 'history'] as Tab[]).map(t => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={cn(
            'flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors capitalize',
            tab === t ? 'text-text-primary' : 'text-text-muted hover:text-text-primary',
          )}
          style={tab === t ? { background: 'var(--surface-3)' } : {}}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

/* --------------------------- FORECAST --------------------------- */

function ForecastCard({ balance, solPrice }: { balance: number; solPrice: number }) {
  const apy = 0.071  // 7.1%
  const week  = balance * apy / 52
  const month = balance * apy / 12
  const year  = balance * apy
  const points = [
    { label: '1 week',  value: week,  fiat: week  * solPrice },
    { label: '1 month', value: month, fiat: month * solPrice },
    { label: '1 year',  value: year,  fiat: year  * solPrice },
  ]
  return (
    <div className="rounded-3xl helio-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-text-primary font-heading font-semibold">Earnings forecast</div>
          <div className="text-text-muted text-xs mt-0.5">Based on selected strategy & current rate</div>
        </div>
        <TrendingUp className="h-4 w-4 text-success" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {points.map(p => (
          <div key={p.label} className="rounded-xl border p-3"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
            <div className="font-eyebrow text-text-muted text-[9px]">{p.label}</div>
            <div className="text-text-primary font-semibold text-sm mt-0.5 font-mono">+{p.value.toFixed(4)} SOL</div>
            <div className="text-text-muted text-[11px] font-mono">≈ ${p.fiat.toFixed(2)}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-text-muted text-[10px] leading-relaxed">
        Estimated returns. APY is variable and not guaranteed.
      </p>
    </div>
  )
}

/* ----------------------------- PDA ------------------------------ */

function PdaDetailsCard({
  pda, strategy, lastSweep, lastWithdraw,
}: { pda: string; strategy: string; lastSweep: number; lastWithdraw: number }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(pda) } catch { /* ignore */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="rounded-3xl helio-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between p-5 text-left hover:bg-surface-3 transition-colors"
      >
        <div>
          <div className="text-text-primary font-heading font-semibold">Advanced details</div>
          <div className="text-text-muted text-xs mt-0.5">Vault address (PDA), strategy & network</div>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t p-5 space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <DetailRow
            label="Vault address (PDA)"
            value={<span className="font-mono text-xs text-text-primary">{pda.slice(0, 10)}…{pda.slice(-6)}</span>}
            actions={
              <>
                <IconButton onClick={handleCopy} ariaLabel="Copy address">
                  <Copy className="h-3.5 w-3.5" />
                </IconButton>
                <a href={`https://solscan.io/account/${pda}`} target="_blank" rel="noopener noreferrer"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:text-text-primary transition-colors"
                  style={{ background: 'var(--surface-3)' }}>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </>
            }
          />
          <DetailRow label="Derivation" value={<span className="text-text-secondary text-xs">user pubkey + Helio seeds + program ID</span>} />
          <DetailRow label="Network"    value={<span className="inline-flex items-center gap-1.5 text-text-secondary text-xs"><span className="h-1.5 w-1.5 rounded-full bg-success" />Mainnet Beta</span>} />
          <DetailRow label="Strategy"   value={<span className="text-text-secondary text-xs">{strategy}</span>} />
          <DetailRow label="Last sweep" value={<span className="text-text-secondary text-xs font-mono">{fmtTs(lastSweep)}</span>} />
          <DetailRow label="Last withdrawal" value={<span className="text-text-secondary text-xs font-mono">{fmtTs(lastWithdraw)}</span>} />
          {copied && <div className="text-success text-xs">Address copied</div>}
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value, actions }: { label: string; value: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-muted text-xs">{label}</span>
      <div className="flex items-center gap-1.5">
        {value}
        {actions}
      </div>
    </div>
  )
}

function IconButton({ children, onClick, ariaLabel }: { children: React.ReactNode; onClick?: () => void; ariaLabel?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel}
      className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:text-text-primary transition-colors"
      style={{ background: 'var(--surface-3)' }}>
      {children}
    </button>
  )
}

/* ----------------------------- RULES ---------------------------- */

type RulesT = { roundUpTransfers: boolean; roundUpSwaps: boolean; percentageIncoming: boolean }

function RulesCard({
  rules, onToggle, threshold, thresholdMode, onThresholdModeChange,
}: {
  rules: RulesT
  onToggle: (key: keyof RulesT, value: boolean) => void
  threshold: number
  thresholdMode: 'auto' | 'notify' | 'manual'
  onThresholdModeChange: (m: 'auto' | 'notify' | 'manual') => void
}) {
  const rows: { key: keyof RulesT; title: string; desc: string }[] = [
    { key: 'roundUpTransfers',   title: 'Round up transfers',  desc: 'Sweep spare change on every SOL send.' },
    { key: 'roundUpSwaps',       title: 'Round up swaps',       desc: 'Sweep spare change on every swap.' },
    { key: 'percentageIncoming', title: '% of incoming',        desc: 'Auto-save a percentage of received SOL.' },
  ]

  return (
    <div className="rounded-3xl helio-card p-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-text-primary font-heading font-semibold">Auto-save rules</div>
          <div className="text-text-muted text-xs mt-0.5">Choose how the vault collects spare change.</div>
        </div>
        <Info className="h-4 w-4 text-text-muted" />
      </div>

      <div className="mt-4 space-y-2">
        {rows.map(r => (
          <RuleRow
            key={r.key}
            title={r.title}
            description={r.desc}
            enabled={rules[r.key]}
            onToggle={v => onToggle(r.key, v)}
          />
        ))}
      </div>

      <ThresholdSection threshold={threshold} mode={thresholdMode} onChange={onThresholdModeChange} />
    </div>
  )
}

function RuleRow({
  title, description, enabled, onToggle,
}: { title: string; description: string; enabled: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border p-3"
      style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex-1 min-w-0">
        <div className="text-text-primary text-sm font-medium">{title}</div>
        <div className="text-text-muted text-xs mt-0.5 leading-relaxed">{description}</div>
      </div>
      <Toggle checked={enabled} onChange={onToggle} />
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors',
        checked ? 'bg-accent-primary' : 'bg-surface-4')}
    >
      <span className={cn(
        'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
        checked && 'translate-x-4',
      )} />
    </button>
  )
}

function ThresholdSection({
  threshold, mode, onChange,
}: { threshold: number; mode: 'auto' | 'notify' | 'manual'; onChange: (m: 'auto' | 'notify' | 'manual') => void }) {
  return (
    <div className="mt-4 rounded-2xl border p-4"
      style={{
        background: 'linear-gradient(135deg, rgba(198,240,0,0.05), transparent 60%)',
        borderColor: 'var(--border-subtle)',
      }}>
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-accent-primary" />
        <span className="text-text-primary text-sm font-semibold">Deployment threshold</span>
      </div>
      <div className="mt-2 text-text-secondary text-sm">
        When the vault balance reaches{' '}
        <span className="text-text-primary font-semibold font-mono">{threshold.toFixed(3)} SOL</span>, Helio will{' '}
        {mode === 'auto' ? 'deploy automatically'
          : mode === 'notify' ? 'notify you first'
            : 'wait for manual confirmation'}.
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1 rounded-full border p-0.5"
        style={{ background: 'var(--surface-3)', borderColor: 'var(--border-subtle)' }}>
        {(['auto', 'notify', 'manual'] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className={cn('rounded-full px-2 py-1 text-xs font-medium capitalize transition-colors',
              mode === m
                ? 'bg-accent-primary text-accent-primary-foreground'
                : 'text-text-muted hover:text-text-primary')}
          >
            {m === 'auto' ? 'Auto-deploy' : m === 'notify' ? 'Notify me' : 'Manual'}
          </button>
        ))}
      </div>
    </div>
  )
}

/* --------------------------- STRATEGY --------------------------- */

function StrategyList({
  selected, onSelect,
}: { selected: string; onSelect: (s: string) => void }) {
  return (
    <div className="rounded-3xl helio-card p-5 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <div>
          <div className="text-text-primary font-heading font-semibold">Strategy</div>
          <div className="text-text-muted text-xs mt-0.5">Where deployed funds earn yield. APY is estimated.</div>
        </div>
      </div>

      {STRATEGIES.map(s => {
        const active = selected === s.name
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.name)}
            className={cn(
              'w-full text-left rounded-2xl border p-3.5 transition-all',
              active ? 'ring-2 ring-accent-primary' : 'hover:bg-surface-3',
            )}
            style={{
              background: 'var(--surface-2)',
              borderColor: active ? 'transparent' : 'var(--border-subtle)',
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-text-primary font-semibold text-sm">{s.name}</span>
                  {active && (
                    <span className="flex items-center gap-1 rounded-full bg-accent-primary text-accent-primary-foreground text-[10px] font-semibold px-1.5 py-0.5">
                      <Check className="h-2.5 w-2.5" />
                      Selected
                    </span>
                  )}
                </div>
                <div className="text-text-muted text-xs mt-0.5">{s.type}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-accent-primary font-semibold text-sm font-mono">~{s.apy}%</div>
                <div className="text-text-muted text-[10px]">est. APY</div>
              </div>
            </div>
            <p className="mt-2 text-text-secondary text-xs leading-relaxed">{s.desc}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
              <RiskChip risk={s.risk} />
              <Chip><Clock className="h-3 w-3" />{s.lockup === 'None' ? 'Instant unstake' : s.lockup}</Chip>
              <Chip>{s.fee}</Chip>
            </div>
          </button>
        )
      })}

      <div className="mt-3 flex items-start gap-2 rounded-xl border p-3 text-xs"
        style={{ background: 'rgba(255,184,77,0.05)', borderColor: 'rgba(255,184,77,0.2)', color: 'var(--warning)' }}>
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span className="leading-relaxed">
          APY shown is estimated, variable and not guaranteed. Strategies involve smart-contract and protocol risk.
        </span>
      </div>
    </div>
  )
}

function RiskChip({ risk }: { risk: 'Low' | 'Medium' | 'High' }) {
  const map = {
    Low:    'text-success bg-success/10 border-success/20',
    Medium: 'text-warning bg-warning/10 border-warning/20',
    High:   'text-danger bg-danger/10 border-danger/20',
  } as const
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium', map[risk])}>
      <span className={cn('h-1 w-1 rounded-full',
        risk === 'Low' && 'bg-success',
        risk === 'Medium' && 'bg-warning',
        risk === 'High' && 'bg-danger')} />
      {risk} risk
    </span>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-text-secondary"
      style={{ background: 'var(--surface-3)', borderColor: 'var(--border-subtle)' }}>
      {children}
    </span>
  )
}

/* ---------------------------- HISTORY --------------------------- */

function VaultHistory({
  lastSweep, lastWithdraw, balance, rewards,
}: { lastSweep: number; lastWithdraw: number; balance: number; rewards: number }) {
  const events: { id: string; date: number; type: 'sweep' | 'withdraw' | 'reward'; label: string; amount: number }[] = []

  if (lastSweep > 0)    events.push({ id: 's', date: lastSweep,    type: 'sweep',    label: 'Vault sweep accumulated', amount: balance })
  if (lastWithdraw > 0) events.push({ id: 'w', date: lastWithdraw, type: 'withdraw', label: 'Vault withdrawal',         amount: 0 })
  if (rewards > 0)      events.push({ id: 'r', date: lastSweep || Math.floor(Date.now()/1000), type: 'reward', label: 'Rewards from validator', amount: rewards })

  events.sort((a, b) => b.date - a.date)

  if (events.length === 0) {
    return (
      <EmptyState
        density="compact"
        eyebrow="No vault signal yet"
        figure="00.0000"
        figureUnit="SOL"
        headline="Round-ups will surface here."
        body="Every sweep, deployment, and reward arrives as an event in this timeline."
      />
    )
  }

  const ICONS = {
    sweep:    { Icon: Sparkles,     color: 'text-accent-primary bg-accent-primary/10' },
    withdraw: { Icon: ArrowDownToLine, color: 'text-warning bg-warning/10' },
    reward:   { Icon: TrendingUp,   color: 'text-success bg-success/10' },
  } as const

  return (
    <div className="rounded-3xl helio-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-text-primary font-heading font-semibold">Vault activity</div>
      </div>
      <div className="relative">
        <div className="absolute left-[18px] top-2 bottom-2 w-px" style={{ background: 'var(--border-subtle)' }} />
        <div className="space-y-3">
          {events.map(e => {
            const { Icon, color } = ICONS[e.type]
            return (
              <div key={e.id} className="relative flex items-start gap-3">
                <span className={cn('relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', color)}
                  style={{ boxShadow: '0 0 0 4px var(--bg)' }}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-text-primary text-sm font-medium leading-tight">{e.label}</div>
                    {e.amount > 0 && (
                      <div className="text-sm font-semibold shrink-0 text-success font-mono">+{e.amount.toFixed(4)} SOL</div>
                    )}
                  </div>
                  <div className="text-text-muted text-xs font-mono mt-0.5">{fmtTs(e.date)}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* -------------------------- EMPTY STATE ------------------------- */

function VaultEmptyState({
  pdaAddress,
  onSetup,
  pending,
  disabled,
}: {
  pdaAddress: string
  onSetup: () => void
  pending: boolean
  disabled: boolean
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl helio-card helio-noise p-6"
      style={{ isolation: 'isolate' }}>
      <OrbitalPattern className="pointer-events-none absolute inset-0 opacity-30" style={{ zIndex: -1 }} />
      <div className="pointer-events-none absolute inset-0 helio-orbit-bg" style={{ zIndex: -1 }} />
      {/* Royal-blue glow — vault identity */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-48 w-48 rounded-full"
        style={{ background: 'rgba(26,31,184,0.22)', filter: 'blur(70px)', zIndex: -1 }} />

      <div className="relative flex flex-col items-start gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl helio-gradient-cosmic text-white helio-float">
            <VaultGlyph size={20} strokeWidth={1.7} />
          </span>
          <span className="font-eyebrow text-text-muted text-[10px] inline-flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-warning" />
            Vault dormant
          </span>
        </div>

        {/* Giant placeholder figure */}
        <div className="flex items-baseline gap-2 leading-none">
          <span className="font-figure text-[56px] font-extrabold text-text-primary/30 tabular-nums tracking-tighter select-none">
            00.0000
          </span>
          <span className="font-figure text-text-muted text-sm font-bold tabular-nums">SOL</span>
        </div>

        <div className="space-y-1.5">
          <h3 className="font-heading text-lg font-bold tracking-tight text-text-primary">
            Turn spare change into yield.
          </h3>
          <p className="text-text-muted text-xs leading-relaxed max-w-[32ch]">
            Set it once. Helio rounds up your transactions and auto-deploys SOL into a yield strategy when the vault hits threshold.
          </p>
        </div>

        <button
          type="button"
          onClick={onSetup}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent-primary px-4 py-2 text-xs font-semibold text-accent-primary-foreground hover:bg-accent-primary-hover transition-colors mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Setting up…
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              Set up Vault
            </>
          )}
        </button>

        <div className="mt-1 font-mono text-text-muted text-[10px] truncate w-full">
          PDA · {pdaAddress ? `${pdaAddress.slice(0, 10)}…${pdaAddress.slice(-6)}` : 'Deriving address…'}
        </div>
      </div>
    </div>
  )
}
