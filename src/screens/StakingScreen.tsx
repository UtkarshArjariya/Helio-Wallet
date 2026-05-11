import React, { useState } from 'react'
import { AlertTriangle, ChevronRight, Layers, Shield, Star } from 'lucide-react'
import { useWallet } from '../contexts/WalletContext'
import { cn } from '../lib/utils'
import { ScreenHeader } from '../components/wallet/ui/ScreenHeader'

interface Validator {
  id: string
  name: string
  apy: number
  commission: number
  reliability: number
  recommended?: boolean
}

const VALIDATORS: Validator[] = [
  { id: 'helio',    name: 'Helio Validator',  apy: 7.1, commission: 5, reliability: 99.4, recommended: true },
  { id: 'jito',     name: 'Jito Restaking',   apy: 8.8, commission: 8, reliability: 99.2 },
  { id: 'marinade', name: 'Marinade Finance', apy: 6.8, commission: 4, reliability: 99.6 },
]

export function StakingScreen() {
  const { tokens } = useWallet()
  const sol = tokens.find(t => t.id === 'sol') ?? tokens[0]
  const [amount, setAmount] = useState('1.0')
  const [validator, setValidator] = useState<Validator>(VALIDATORS[0])
  const [showPicker, setShowPicker] = useState(false)

  const num         = parseFloat(amount) || 0
  const insufficient = num > Math.max(0, sol.balance - 0.01)
  const valid       = num > 0 && !insufficient
  const estReturn   = (num * validator.apy) / 100

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Stake SOL" subtitle="Earn rewards each epoch" />

      <div className="relative p-4 space-y-4" style={{ isolation: 'isolate' }}>
        {/* Royal-blue glow — yield surface */}
        <div className="pointer-events-none absolute -left-12 top-20 h-60 w-60 rounded-full"
          style={{ background: 'rgba(26,31,184,0.16)', filter: 'blur(80px)', zIndex: -1 }} />

        {/* Amount */}
        <div className="rounded-3xl helio-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="font-eyebrow text-text-muted text-[10px]">Stake amount</span>
            <button
              type="button"
              onClick={() => setAmount(Math.max(0, sol.balance - 0.01).toFixed(4))}
              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-accent-primary hover:opacity-80"
              style={{ background: 'rgba(198,240,0,0.12)' }}
            >
              MAX
            </button>
          </div>

          <div className="flex items-baseline gap-2">
            <input
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="flex-1 bg-transparent font-figure text-4xl font-bold text-text-primary outline-none placeholder:text-text-muted"
            />
            <span className="text-text-secondary text-lg font-semibold font-heading">SOL</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-text-muted font-mono">
            <span>Balance: {sol.balance.toFixed(4)} SOL</span>
            <span>≈ ${(num * sol.price).toFixed(2)}</span>
          </div>
        </div>

        {/* Validator selector */}
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="flex w-full items-center gap-3 rounded-3xl helio-card p-4 hover:bg-surface-3 transition-colors text-left"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl helio-gradient-cosmic text-white">
            <Layers className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-text-primary font-semibold text-sm">{validator.name}</span>
              {validator.recommended && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent-primary">
                  <Star className="h-2.5 w-2.5" />
                  Recommended
                </span>
              )}
            </div>
            <div className="text-text-muted text-xs">
              ~{validator.apy}% APY · {validator.commission}% commission
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-text-muted" />
        </button>

        {/* Summary */}
        <div className="rounded-3xl helio-card p-5 space-y-2.5">
          <Row label="Estimated APY"           value={`${validator.apy}%`}                    accent />
          <Row label="Estimated annual return" value={`${estReturn.toFixed(4)} SOL`} />
          <Row label="Reliability"             value={`${validator.reliability}%`} />
          <Row label="Cooldown"                value="~2 epochs (≈ 2 days)" />
          <Row label="Network fee"             value="~0.000005 SOL" />
        </div>

        {insufficient && (
          <div className="flex items-start gap-2 rounded-2xl border p-3 text-xs"
            style={{ background: 'rgba(255,184,77,0.06)', borderColor: 'rgba(255,184,77,0.25)', color: 'var(--warning)' }}>
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Keep at least 0.01 SOL in your wallet to cover network fees.</span>
          </div>
        )}

        <button
          type="button"
          disabled={!valid}
          className={cn(
            'w-full rounded-full py-3.5 text-sm font-semibold transition-colors',
            valid
              ? 'bg-accent-primary text-accent-primary-foreground hover:bg-accent-primary-hover'
              : 'text-text-muted cursor-not-allowed',
          )}
          style={!valid ? { background: 'var(--surface-3)' } : {}}
        >
          {num <= 0
            ? 'Enter an amount'
            : insufficient
              ? 'Reduce amount'
              : `Stake ${num} SOL`}
        </button>

        <p className="text-center text-xs text-text-muted">Staking locks SOL to secure the Solana network.</p>
      </div>

      {showPicker && (
        <ValidatorPicker
          selected={validator.id}
          onSelect={id => {
            const v = VALIDATORS.find(x => x.id === id)!
            setValidator(v)
            setShowPicker(false)
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

function ValidatorPicker({
  selected, onSelect, onClose,
}: { selected: string; onSelect: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const filtered = VALIDATORS.filter(v => v.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-md rounded-3xl helio-card p-4" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-text-primary font-heading font-semibold">Select validator</span>
          <button type="button" onClick={onClose} className="text-text-muted text-xs hover:text-text-primary">Close</button>
        </div>
        <input
          type="text"
          placeholder="Search validators"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full rounded-2xl border px-4 py-3 text-sm text-text-primary outline-none placeholder:text-text-muted"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
        />
        <div className="mt-3 space-y-2 max-h-[60vh] overflow-y-auto helio-scrollbar">
          {filtered.map(v => (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border p-3 hover:bg-surface-3 transition-colors text-left',
                selected === v.id && 'ring-2 ring-accent-primary',
              )}
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl helio-gradient-cosmic text-white shrink-0">
                <Layers className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-text-primary font-medium text-sm">{v.name}</span>
                  {v.recommended && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent-primary">
                      <Star className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-text-muted text-xs">
                  <Shield className="h-3 w-3" />
                  {v.reliability}% reliability · {v.commission}% commission
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-accent-primary font-semibold text-sm font-mono">~{v.apy}%</div>
                <div className="text-text-muted text-[10px]">APY</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-muted text-xs">{label}</span>
      <span className={cn('font-medium font-mono', accent ? 'text-accent-primary' : 'text-text-secondary')}>{value}</span>
    </div>
  )
}
