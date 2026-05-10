import React, { useState } from 'react'
import { Shield } from 'lucide-react'
import { useWallet } from '../contexts/WalletContext'
import { cn } from '../lib/utils'

interface Validator {
  id: string
  name: string
  apy: number
  commission: number
}

const VALIDATORS: Validator[] = [
  { id: 'helio',   name: 'Helio Validator',  apy: 7.1, commission: 5 },
  { id: 'jito',    name: 'Jito Restaking',   apy: 8.8, commission: 8 },
  { id: 'marinade',name: 'Marinade Finance', apy: 6.8, commission: 4 },
]

export function StakingScreen() {
  const { tokens } = useWallet()
  const sol = tokens.find((t) => t.id === 'sol') ?? tokens[0]
  const [amount, setAmount] = useState('')
  const [validator, setValidator] = useState<Validator>(VALIDATORS[0])
  const [showPicker, setShowPicker] = useState(false)

  const num = parseFloat(amount) || 0
  const valid = num > 0 && num <= sol.balance
  const estReturn = (num * validator.apy) / 100
  const estReturnUsd = estReturn * sol.price

  return (
    <div className="flex flex-col">
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="text-text-primary font-heading font-semibold">Stake SOL</div>
        <div className="text-text-muted text-xs">Earn rewards by securing Solana</div>
      </div>

      <div className="p-4 space-y-3">
        {/* Validator selector */}
        <div className="rounded-3xl helio-card p-5">
          <p className="text-text-muted text-xs uppercase tracking-wider mb-3">Validator</p>
          <button type="button" onClick={() => setShowPicker(true)}
            className="flex w-full items-center gap-3 rounded-2xl border p-3 hover:bg-surface-3 transition-colors"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
              style={{ background: 'rgba(198,240,0,0.1)' }}>
              <Shield className="h-4 w-4 text-accent-primary" />
            </span>
            <div className="flex-1 text-left">
              <div className="text-text-primary text-sm font-medium">{validator.name}</div>
              <div className="text-success text-xs">{validator.apy}% APY · {validator.commission}% commission</div>
            </div>
            <span className="text-text-muted text-xs">Change</span>
          </button>
        </div>

        {/* Amount */}
        <div className="rounded-3xl helio-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-text-muted text-xs uppercase tracking-wider">Amount to stake</span>
            <button type="button" onClick={() => setAmount(String(sol.balance))}
              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-accent-primary"
              style={{ background: 'rgba(198,240,0,0.1)' }}>
              MAX
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm text-accent-primary-foreground shrink-0"
              style={{ background: 'var(--accent-primary)' }}>
              S
            </div>
            <input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-transparent text-right text-3xl font-heading font-semibold text-text-primary outline-none placeholder:text-text-muted" />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
            <span>Available: {sol.balance} {sol.symbol}</span>
            <span>≈ ${(num * sol.price).toFixed(2)}</span>
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-3xl helio-card p-5 space-y-2.5">
          {[
            { label: 'Est. annual return', value: `+${estReturn.toFixed(4)} SOL`, accent: true },
            { label: 'Est. USD return',    value: `≈ $${estReturnUsd.toFixed(2)}` },
            { label: 'Unstaking period',   value: '~2–3 days' },
            { label: 'Network fee',        value: '~0.000005 SOL' },
          ].map(({ label, value, accent }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-text-muted text-xs">{label}</span>
              <span className={cn('font-medium', accent ? 'text-success' : 'text-text-secondary')}>{value}</span>
            </div>
          ))}
        </div>

        <button type="button" disabled={!valid}
          className={cn('w-full rounded-full py-3.5 text-sm font-semibold transition-colors',
            valid ? 'bg-accent-primary text-accent-primary-foreground hover:bg-accent-primary-hover' : 'text-text-muted cursor-not-allowed')}
          style={!valid ? { background: 'var(--surface-3)' } : {}}>
          {valid ? `Stake ${num.toFixed(4)} SOL` : 'Enter an amount'}
        </button>

        <p className="text-center text-xs text-text-muted">Staking locks SOL to secure the Solana network.</p>
      </div>

      {/* Validator picker modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowPicker(false)}>
          <div className="w-full max-w-md rounded-3xl helio-card p-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-text-primary font-semibold">Select validator</span>
              <button type="button" onClick={() => setShowPicker(false)}
                className="text-text-muted text-xs hover:text-text-primary">Close</button>
            </div>
            <div className="space-y-1">
              {VALIDATORS.map((v) => {
                const active = validator.id === v.id
                return (
                  <button key={v.id} type="button"
                    onClick={() => { setValidator(v); setShowPicker(false) }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 hover:bg-surface-3 transition-colors text-left">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
                      style={{ background: active ? 'rgba(198,240,0,0.15)' : 'var(--surface-3)' }}>
                      <Shield className={cn('h-4 w-4', active ? 'text-accent-primary' : 'text-text-muted')} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-text-primary text-sm font-medium">{v.name}</div>
                      <div className="text-success text-xs">{v.apy}% APY · {v.commission}% fee</div>
                    </div>
                    {active && <span className="h-2 w-2 rounded-full bg-accent-primary shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
