import React, { useState } from 'react'
import {
  Sparkles, Play, Pause, Copy, ExternalLink, TrendingUp, Layers,
  Loader2, CheckCircle, AlertTriangle, ArrowDownLeft,
} from 'lucide-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useWallet } from '../contexts/WalletContext'
import { Switch } from '../components/ui/switch'
import { cn } from '../lib/utils'

type Tab = 'overview' | 'rules' | 'strategy' | 'history'
type HistoryKind = 'sweep' | 'deploy' | 'reward'

const STRATEGIES = [
  { id: 'helio',  name: 'Helio Validator', apy: 7.1,  risk: 'Low',     lockup: 'None',   desc: 'Stake with the official Helio validator. Liquid, low-risk.' },
  { id: 'kamino', name: 'Kamino Finance',  apy: 12.3, risk: 'Medium',  lockup: '7 days', desc: 'Earn yield on SOL via Kamino lending markets.' },
  { id: 'jito',   name: 'Jito Restaking',  apy: 8.8,  risk: 'Low-Med', lockup: 'None',   desc: 'Liquid restaking via Jito for MEV-enhanced rewards.' },
]

const HISTORY_ICON: Record<HistoryKind, string> = { sweep: '↑', deploy: '→', reward: '★' }

function fmtTs(unix: number): string {
  if (!unix) return '—'
  return new Date(unix * 1000).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function solscanTx(sig: string) {
  window.open(`https://solscan.io/tx/${sig}`, '_blank', 'noopener,noreferrer')
}

export function VaultScreen() {
  const {
    vault, hasKeypair, tokens,
    pauseVault, resumeVault, updateVaultConfig,
    addFundsToVault, withdrawFromVault,
    updateVaultRule,
  } = useWallet()

  const [tab, setTab] = useState<Tab>('overview')
  const [selectedStrategy, setSelectedStrategy] = useState(vault.strategy)

  const [pending,    setPending]    = useState(false)
  const [txSig,      setTxSig]      = useState<string | null>(null)
  const [txError,    setTxError]    = useState<string | null>(null)
  const [addAmount,  setAddAmount]  = useState('')
  const [withAmount, setWithAmount] = useState('')

  const solToken = tokens.find(t => t.id === 'sol')
  const solPrice = solToken?.price ?? 145
  const progress = vault.threshold > 0
    ? Math.min(Math.round((vault.balance / vault.threshold) * 100), 100)
    : 0

  async function run(label: string, fn: () => Promise<{ signature: string }>) {
    setPending(true)
    setTxError(null)
    setTxSig(null)
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

  const handleAddFunds = () => {
    const lamports = Math.floor(parseFloat(addAmount) * LAMPORTS_PER_SOL)
    if (!lamports) return
    run('Add funds', () => addFundsToVault(lamports))
      .then(() => setAddAmount(''))
  }

  const handleWithdraw = () => {
    const lamports = Math.floor(parseFloat(withAmount) * LAMPORTS_PER_SOL)
    if (!lamports) return
    run('Withdraw', () => withdrawFromVault(lamports))
      .then(() => setWithAmount(''))
  }

  const handleRuleToggle = async (key: keyof typeof vault.rules, value: boolean) => {
    // Optimistic local update
    updateVaultRule(key, value)
    if (!vault.initialized || !hasKeypair) return
    // Map rules back to sweep mode for on-chain update
    const sweepMode = key === 'percentageIncoming' ? (value ? 1 : 0) :
                      key === 'roundUpTransfers'    ? (value ? 0 : 1) : 0
    try {
      await updateVaultConfig({
        enabled: vault.isActive,
        sweepMode,
        percentageBps: 100,
        roundUpUnitLamports: 10_000_000,
        deployThresholdAtomic: Math.round(vault.threshold * LAMPORTS_PER_SOL),
      })
    } catch { /* revert optimistic */ updateVaultRule(key, !value) }
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent-primary" />
          <span className="text-text-primary font-heading font-semibold">Helio Vault</span>
        </div>
        {vault.initialized && (
          <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full',
            vault.isActive ? 'text-success' : 'text-warning')}
            style={{ background: vault.isActive ? 'rgba(198,240,0,0.1)' : 'rgba(255,184,77,0.1)' }}>
            {vault.isActive ? 'Accumulating' : 'Paused'}
          </span>
        )}
      </div>

      {/* Feedback banner */}
      {txSig && (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border p-3"
          style={{ background: 'rgba(198,240,0,0.06)', borderColor: 'rgba(198,240,0,0.18)' }}>
          <CheckCircle className="h-4 w-4 text-success shrink-0" />
          <span className="text-text-primary text-xs flex-1">Transaction confirmed</span>
          <button type="button" onClick={() => solscanTx(txSig)}
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

      {/* Not initialised state */}
      {!vault.initialized && (
        <div className="p-4">
          <div className="rounded-3xl helio-card helio-noise p-6 text-center">
            <Sparkles className="h-10 w-10 text-accent-primary mx-auto mb-3" />
            <div className="text-text-primary font-semibold mb-1">Vault not set up</div>
            <div className="text-text-muted text-sm mb-4">
              Your auto-yield vault hasn't been initialized on-chain yet. Once the program is deployed, you'll be able to start earning on spare SOL.
            </div>
            <div className="text-text-muted text-xs font-mono break-all">{vault.pdaAddress || 'Deriving address…'}</div>
          </div>
        </div>
      )}

      {/* Initialized vault hero */}
      {vault.initialized && (
        <div className="p-4">
          <div className="rounded-3xl helio-card helio-noise p-5 text-center">
            <p className="text-text-muted text-xs uppercase tracking-wider mb-1">Vault Balance</p>
            <h3 className="font-heading text-4xl font-bold text-accent-primary" style={{ letterSpacing: '-0.03em' }}>
              {vault.balance.toFixed(4)} SOL
            </h3>
            <p className="text-text-muted text-xs mt-1">≈ ${(vault.balance * solPrice).toFixed(2)}</p>

            <div className="mt-4 mb-2">
              <div className="flex justify-between text-xs text-text-muted mb-1.5">
                <span>{progress}% to threshold</span>
                <span>{vault.threshold.toFixed(3)} SOL</span>
              </div>
              <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                <div className="h-full rounded-full bg-accent-primary transition-all duration-700" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4">
              {[
                { label: 'Strategy', value: vault.strategy.split(' ')[0] },
                { label: 'Last sweep', value: vault.lastSweepAt ? fmtTs(vault.lastSweepAt).split(',')[0] : '—' },
                { label: 'Last withdraw', value: vault.lastWithdrawAt ? fmtTs(vault.lastWithdrawAt).split(',')[0] : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl p-2.5" style={{ background: 'var(--surface-3)' }}>
                  <div className="text-text-muted text-[10px] uppercase tracking-wider">{label}</div>
                  <div className="font-semibold text-xs mt-0.5 text-text-primary truncate">{value}</div>
                </div>
              ))}
            </div>

            {/* Add funds */}
            <div className="flex items-center gap-2 mt-4">
              <input type="number" inputMode="decimal" placeholder="Amount (SOL)" value={addAmount}
                onChange={e => setAddAmount(e.target.value)} min="0" step="0.001"
                className="flex-1 rounded-full border px-4 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted bg-transparent"
                style={{ borderColor: 'var(--border-subtle)' }} />
              <button type="button" onClick={handleAddFunds}
                disabled={pending || !parseFloat(addAmount) || !hasKeypair}
                className={cn('flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors shrink-0',
                  pending || !parseFloat(addAmount) || !hasKeypair
                    ? 'text-text-muted cursor-not-allowed' : 'bg-accent-primary text-accent-primary-foreground hover:bg-accent-primary-hover')}
                style={pending || !parseFloat(addAmount) || !hasKeypair ? { background: 'var(--surface-3)' } : {}}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                Add
              </button>
            </div>

            {/* Withdraw */}
            <div className="flex items-center gap-2 mt-2">
              <input type="number" inputMode="decimal" placeholder="Withdraw (SOL)" value={withAmount}
                onChange={e => setWithAmount(e.target.value)} min="0" step="0.001"
                className="flex-1 rounded-full border px-4 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted bg-transparent"
                style={{ borderColor: 'var(--border-subtle)' }} />
              <button type="button" onClick={handleWithdraw}
                disabled={pending || !parseFloat(withAmount) || !hasKeypair}
                className={cn('flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors shrink-0',
                  pending || !parseFloat(withAmount) || !hasKeypair ? 'text-text-muted cursor-not-allowed' : 'text-text-primary hover:bg-surface-3')}
                style={{ borderColor: 'var(--border-subtle)', ...(pending || !parseFloat(withAmount) || !hasKeypair ? { background: 'var(--surface-3)' } : {}) }}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownLeft className="h-4 w-4" />}
                Withdraw
              </button>
            </div>

            {/* Pause / resume */}
            <button type="button" onClick={handlePauseResume}
              disabled={pending || !hasKeypair}
              className={cn('flex w-full items-center justify-center gap-2 rounded-full border py-2.5 text-sm font-medium mt-2 transition-colors',
                pending || !hasKeypair ? 'text-text-muted cursor-not-allowed' : 'text-text-primary hover:bg-surface-3')}
              style={{ borderColor: 'var(--border-subtle)' }}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> :
               vault.isActive ? <><Pause className="h-4 w-4" />Pause vault</> : <><Play className="h-4 w-4" />Resume vault</>}
            </button>

            {!hasKeypair && (
              <p className="text-text-muted text-[11px] mt-2">Import your wallet to sign transactions.</p>
            )}
          </div>
        </div>
      )}

      {/* Tabs (only show when initialized) */}
      {vault.initialized && (
        <>
          <div className="px-4 pb-2">
            <div className="flex gap-1 rounded-full p-1 border" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}>
              {(['overview', 'rules', 'strategy', 'history'] as Tab[]).map(t => (
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
                <p className="text-text-primary font-semibold text-sm mb-3">On-chain details</p>
                {[
                  { label: 'Config PDA',    value: `${vault.pdaAddress.slice(0, 8)}…${vault.pdaAddress.slice(-6)}`, copy: vault.pdaAddress },
                  { label: 'Status',         value: vault.isActive ? 'Accumulating' : 'Paused' },
                  { label: 'Sweep mode',     value: vault.rules.roundUpTransfers ? 'Round-up' : 'Percentage' },
                  { label: 'Strategy',       value: vault.strategy },
                  { label: 'Threshold',      value: `${vault.threshold.toFixed(4)} SOL` },
                  { label: 'Last sweep',     value: vault.lastSweepAt ? fmtTs(vault.lastSweepAt) : '—' },
                  { label: 'Last withdraw',  value: vault.lastWithdrawAt ? fmtTs(vault.lastWithdrawAt) : '—' },
                ].map(({ label, value, copy }, i, arr) => (
                  <div key={label} className={cn('flex items-center justify-between py-2 text-sm', i < arr.length - 1 && 'border-b')}
                    style={i < arr.length - 1 ? { borderColor: 'var(--border-subtle)' } : {}}>
                    <span className="text-text-muted text-xs">{label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-text-primary font-mono text-xs">{value}</span>
                      {copy && (
                        <>
                          <button type="button" aria-label="Copy" onClick={() => navigator.clipboard.writeText(copy)}
                            className="text-text-muted hover:text-text-primary"><Copy className="h-3 w-3" /></button>
                          <a href={`https://solscan.io/account/${copy}`} target="_blank" rel="noopener noreferrer"
                            className="text-text-muted hover:text-text-primary"><ExternalLink className="h-3 w-3" /></a>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'rules' && (
              <div className="rounded-2xl helio-card p-4 space-y-3">
                <p className="text-text-primary font-semibold text-sm mb-1">Auto-save rules</p>
                {([
                  { key: 'roundUpTransfers',   label: 'Round-up transfers',   sub: 'Sweep spare change on every SOL send' },
                  { key: 'roundUpSwaps',        label: 'Round-up swaps',       sub: 'Sweep spare change on every swap' },
                  { key: 'percentageIncoming',  label: '% of incoming',        sub: 'Auto-save a % of received SOL' },
                ] as { key: keyof typeof vault.rules; label: string; sub: string }[]).map(({ key, label, sub }) => (
                  <div key={key} className="flex items-center justify-between rounded-xl border p-3"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
                    <div className="min-w-0 mr-3">
                      <div className="text-text-primary text-sm font-medium">{label}</div>
                      <div className="text-text-muted text-xs">{sub}</div>
                    </div>
                    <Switch checked={vault.rules[key]} onCheckedChange={v => handleRuleToggle(key, v)} />
                  </div>
                ))}
              </div>
            )}

            {tab === 'strategy' && (
              <div className="space-y-2">
                {STRATEGIES.map(s => {
                  const active = selectedStrategy === s.name
                  return (
                    <button key={s.id} type="button" onClick={() => setSelectedStrategy(s.name as any)}
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
                {vault.lastSweepAt ? (
                  <>
                    {vault.lastSweepAt > 0 && (
                      <div className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-3 transition-colors">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold shrink-0"
                          style={{ background: 'rgba(198,240,0,0.1)', color: 'var(--success)' }}>
                          {HISTORY_ICON.sweep}
                        </span>
                        <div className="flex-1">
                          <div className="text-text-primary text-sm font-medium">Last sweep</div>
                          <div className="text-text-muted text-xs">{fmtTs(vault.lastSweepAt)}</div>
                        </div>
                        <div className="text-sm font-medium text-success">{vault.balance.toFixed(4)} SOL in reserve</div>
                      </div>
                    )}
                    {vault.lastWithdrawAt > 0 && (
                      <div className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-3 transition-colors">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold shrink-0"
                          style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}>
                          {HISTORY_ICON.deploy}
                        </span>
                        <div className="flex-1">
                          <div className="text-text-primary text-sm font-medium">Last withdrawal</div>
                          <div className="text-text-muted text-xs">{fmtTs(vault.lastWithdrawAt)}</div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-8 text-center text-text-muted text-sm">No activity yet.</div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
