import React, { useState } from 'react'
import { AlertTriangle, BookOpen, ChevronDown, Send } from 'lucide-react'
import { useRouter } from '../contexts/RouterContext'
import { useWallet } from '../contexts/WalletContext'
import { cn } from '../lib/utils'

const NETWORK_FEE = 0.000005

function isValidAmount(raw: string): boolean {
  const n = parseFloat(raw)
  return !isNaN(n) && n > 0 && isFinite(n)
}

export function SendScreen() {
  const { navigate } = useRouter()
  const { tokens } = useWallet()
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')

  const token = tokens.find((t) => t.id === 'sol') ?? tokens[0]
  const numericAmount = isValidAmount(amount) ? parseFloat(amount) : 0
  const fiatValue = numericAmount * token.price
  const insufficient = numericAmount > 0 && numericAmount > token.balance
  // Basic Solana address validation: 32–44 base58 chars
  const recipientValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(recipient) || recipient.endsWith('.sol')
  const valid = numericAmount > 0 && !insufficient && recipientValid

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <div className="text-text-primary font-heading font-semibold">Send</div>
          <div className="text-text-muted text-xs">Solana mainnet</div>
        </div>
        <button type="button" onClick={() => navigate('/')} className="text-text-muted text-xs hover:text-text-primary">
          Cancel
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Token + amount */}
        <div className="rounded-3xl helio-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-text-muted text-xs uppercase tracking-wider">You send</span>
            <button type="button" onClick={() => setAmount(String(token.balance))}
              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-accent-primary hover:opacity-80"
              style={{ background: 'rgba(198,240,0,0.1)' }}>
              MAX
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button type="button"
              className="flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-3"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
              <div className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-accent-primary-foreground shrink-0"
                style={{ background: 'var(--accent-primary)' }}>
                {token.symbol[0]}
              </div>
              {token.symbol}
              <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
            </button>
            <input inputMode="decimal" placeholder="0.00" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-transparent text-right text-3xl font-heading font-semibold text-text-primary outline-none placeholder:text-text-muted" />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
            <span>Balance: {token.balance.toFixed(4)} {token.symbol}</span>
            <span>≈ ${fiatValue.toFixed(2)}</span>
          </div>
        </div>

        {/* Recipient */}
        <div className="rounded-3xl helio-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-text-muted text-xs uppercase tracking-wider">Recipient</span>
            <button type="button" className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary">
              <BookOpen className="h-3.5 w-3.5" />Address book
            </button>
          </div>
          <input type="text" placeholder="Wallet address or .sol domain"
            value={recipient} onChange={(e) => setRecipient(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-mono text-text-primary outline-none placeholder:text-text-muted"
            style={{ background: 'var(--surface-2)', borderColor: recipient && !recipientValid ? 'var(--danger)' : 'var(--border-subtle)' }} />
          {recipient && !recipientValid && (
            <p className="text-xs text-danger mt-1.5">Enter a valid Solana address or .sol domain.</p>
          )}
        </div>

        {/* Fee summary */}
        <div className="rounded-3xl helio-card p-5 space-y-2.5">
          {[
            { label: 'Network fee', value: `${NETWORK_FEE} SOL`, sub: '≈ $0.001' },
            { label: 'Vault round-up', value: '+0.012 SOL', accent: true },
            { label: "You'll send", value: `${numericAmount.toFixed(4)} SOL`, bold: true },
          ].map(({ label, value, sub, accent, bold }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-text-muted text-xs">{label}</span>
              <div className="text-right">
                <div className={cn('text-sm', accent ? 'text-accent-primary font-medium' : bold ? 'text-text-primary font-semibold' : 'text-text-secondary')}>
                  {value}
                </div>
                {sub && <div className="text-text-muted text-xs">{sub}</div>}
              </div>
            </div>
          ))}
        </div>

        {insufficient && (
          <div className="flex items-start gap-2 rounded-2xl border p-3 text-xs text-danger"
            style={{ background: 'rgba(255,59,63,0.08)', borderColor: 'rgba(255,59,63,0.25)' }}>
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Insufficient balance. Reduce the amount or top up your wallet.</span>
          </div>
        )}

        <button type="button" disabled={!valid}
          className={cn('flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold transition-colors',
            valid ? 'bg-accent-primary text-accent-primary-foreground hover:bg-accent-primary-hover' : 'text-text-muted cursor-not-allowed')}
          style={!valid ? { background: 'var(--surface-3)' } : {}}>
          <Send className="h-4 w-4" />
          {valid ? 'Review & send' : 'Enter amount and recipient'}
        </button>
      </div>
    </div>
  )
}
