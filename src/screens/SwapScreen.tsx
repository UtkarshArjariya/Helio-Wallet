import React, { useState } from 'react'
import { ArrowDown, ChevronDown, Settings2 } from 'lucide-react'
import { useWallet } from '../contexts/WalletContext'
import { cn } from '../lib/utils'

export function SwapScreen() {
  const { tokens } = useWallet()
  const [sellToken, setSellToken] = useState(tokens[0])
  const [buyToken, setBuyToken]   = useState(tokens[1] ?? tokens[0])
  const [sellAmount, setSellAmount] = useState('')
  const [showDetails, setShowDetails] = useState(true)

  const sellNum  = parseFloat(sellAmount || '0')
  const buyAmt   = sellNum > 0 ? (sellNum * (sellToken.price / buyToken.price)).toFixed(4) : ''
  const valid    = sellNum > 0 && sellNum <= sellToken.balance

  const flip = () => { const t = sellToken; setSellToken(buyToken); setBuyToken(t) }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <div className="text-text-primary font-heading font-semibold">Swap</div>
          <div className="text-text-muted text-xs">Best route across Jupiter</div>
        </div>
        <button type="button" aria-label="Settings"
          className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:text-text-primary transition-colors"
          style={{ background: 'var(--surface-2)' }}>
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-2">
        {/* Sell card */}
        <SwapCard label="You sell" token={sellToken} amount={sellAmount} onAmountChange={setSellAmount} showShortcuts />
        {/* Flip */}
        <div className="relative -my-2 flex items-center justify-center z-10">
          <button type="button" onClick={flip}
            className="flex h-9 w-9 items-center justify-center rounded-full border text-text-primary hover:bg-surface-4 transition-colors"
            style={{ background: 'var(--surface-3)', borderColor: 'var(--border-subtle)', outline: '4px solid var(--bg)' }}>
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>
        {/* Buy card */}
        <SwapCard label="You buy" token={buyToken} amount={buyAmt} readOnly />
      </div>

      {/* Rate & details */}
      <div className="px-4 pt-2 space-y-2">
        <button type="button" onClick={() => setShowDetails((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl helio-card px-4 py-3 text-sm text-text-secondary hover:bg-surface-3">
          <span>1 {sellToken.symbol} ≈ <span className="text-text-primary font-medium">{(sellToken.price / buyToken.price).toLocaleString('en-US', { maximumFractionDigits: 4 })}</span> {buyToken.symbol}</span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', showDetails && 'rotate-180')} />
        </button>
        {showDetails && (
          <div className="rounded-2xl helio-card p-4 space-y-2 text-xs">
            {[
              { label: 'Best route', value: 'Jupiter aggregator' },
              { label: 'Network fee', value: '0.000005 SOL' },
              { label: 'Slippage tolerance', value: '0.5%' },
              { label: 'Vault round-up', value: '+$0.36 to vault', accent: true },
            ].map(({ label, value, accent }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-text-muted">{label}</span>
                <span className={cn('font-medium', accent ? 'text-accent-primary' : 'text-text-secondary')}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4">
        <button type="button" disabled={!valid}
          className={cn('w-full rounded-full py-3.5 text-sm font-semibold transition-colors',
            valid ? 'bg-accent-primary text-accent-primary-foreground hover:bg-accent-primary-hover' : 'text-text-muted cursor-not-allowed')}
          style={!valid ? { background: 'var(--surface-3)' } : {}}>
          {!sellNum ? 'Enter an amount' : sellNum > sellToken.balance ? 'Insufficient balance' : `Swap ${sellToken.symbol} → ${buyToken.symbol}`}
        </button>
      </div>
    </div>
  )
}

function SwapCard({ label, token, amount, onAmountChange, readOnly, showShortcuts }: {
  label: string; token: { symbol: string; balance: number; price: number }
  amount: string; onAmountChange?: (v: string) => void; readOnly?: boolean; showShortcuts?: boolean
}) {
  const num  = parseFloat(amount || '0')
  const fiat = num * token.price
  return (
    <div className="rounded-3xl helio-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-text-muted text-xs uppercase tracking-wider">{label}</span>
        <span className="text-text-muted text-xs">Balance: <span className="text-text-secondary font-medium">{token.balance.toLocaleString('en-US', { maximumFractionDigits: 4 })}</span></span>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-3"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
          <div className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-accent-primary-foreground shrink-0"
            style={{ background: 'var(--accent-primary)' }}>{token.symbol[0]}</div>
          {token.symbol}<ChevronDown className="h-3.5 w-3.5 text-text-muted" />
        </button>
        <input inputMode="decimal" placeholder="0.00" readOnly={readOnly} value={amount} onChange={(e) => onAmountChange?.(e.target.value)}
          className={cn('flex-1 bg-transparent text-right text-3xl font-heading font-semibold outline-none placeholder:text-text-muted',
            readOnly ? 'text-text-secondary' : 'text-text-primary')} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        {showShortcuts && onAmountChange ? (
          <div className="flex items-center gap-1">
            {['25', '50', '75', 'Max'].map((p) => (
              <button key={p} type="button" onClick={() => { const pct = p === 'Max' ? 100 : Number(p); onAmountChange(((token.balance * pct) / 100).toString()) }}
                className="rounded-full px-2 py-0.5 text-[11px] font-medium text-text-secondary hover:text-text-primary"
                style={{ background: 'var(--surface-3)' }}>
                {p === 'Max' ? p : `${p}%`}
              </button>
            ))}
          </div>
        ) : <div />}
        <div className="text-text-muted text-xs">≈ ${fiat.toFixed(2)}</div>
      </div>
    </div>
  )
}
