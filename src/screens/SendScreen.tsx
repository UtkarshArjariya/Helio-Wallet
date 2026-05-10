import React, { useState } from 'react'
import { AlertTriangle, BookOpen, ChevronDown, Send, CheckCircle, ExternalLink, Loader2 } from 'lucide-react'
import { useRouter } from '../contexts/RouterContext'
import { useWallet } from '../contexts/WalletContext'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { cn } from '../lib/utils'

const SWEEP_BPS_DEFAULT = 50  // 0.5% vault sweep on every send

function isValidAmount(raw: string): boolean {
  const n = parseFloat(raw)
  return !isNaN(n) && n > 0 && isFinite(n)
}

export function SendScreen() {
  const { navigate } = useRouter()
  const { tokens, sendSolWithSweep, hasKeypair } = useWallet()

  const [amount,    setAmount]    = useState('')
  const [recipient, setRecipient] = useState('')
  const [sending,   setSending]   = useState(false)
  const [txResult,  setTxResult]  = useState<{ sig: string; url: string } | null>(null)
  const [txError,   setTxError]   = useState<string | null>(null)

  const token = tokens.find(t => t.id === 'sol') ?? tokens[0]
  const numericAmount = isValidAmount(amount) ? parseFloat(amount) : 0
  const fiatValue     = numericAmount * (token?.price ?? 0)
  const sweepAmount   = Math.max(1, Math.floor(numericAmount * LAMPORTS_PER_SOL * SWEEP_BPS_DEFAULT / 10_000))
  const sweepSol      = sweepAmount / LAMPORTS_PER_SOL
  const insufficient  = numericAmount > 0 && numericAmount > (token?.balance ?? 0)
  const recipientValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(recipient) || recipient.endsWith('.sol')
  const valid = numericAmount > 0 && !insufficient && recipientValid && hasKeypair && !sending

  const handleSend = async () => {
    if (!valid) return
    setSending(true)
    setTxError(null)
    setTxResult(null)
    try {
      const result = await sendSolWithSweep(recipient, Math.floor(numericAmount * LAMPORTS_PER_SOL), SWEEP_BPS_DEFAULT)
      setTxResult({ sig: result.signature, url: result.explorerUrl })
      setAmount('')
      setRecipient('')
    } catch (err: any) {
      setTxError(err?.message ?? 'Transaction failed.')
    } finally {
      setSending(false)
    }
  }

  // Success screen
  if (txResult) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="text-text-primary font-heading font-semibold">Sent</div>
          <button type="button" onClick={() => navigate('/')} className="text-text-muted text-xs hover:text-text-primary">Done</button>
        </div>
        <div className="p-4 flex flex-col items-center text-center gap-4 pt-10">
          <CheckCircle className="h-14 w-14 text-success" />
          <div>
            <div className="text-text-primary font-heading font-semibold text-lg">Transaction sent!</div>
            <div className="text-text-muted text-sm mt-1 font-mono break-all px-4">{txResult.sig.slice(0, 20)}…</div>
          </div>
          <a href={txResult.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-accent-primary px-5 py-2.5 text-sm font-semibold text-accent-primary-foreground hover:bg-accent-primary-hover transition-colors">
            <ExternalLink className="h-4 w-4" /> View on Solscan
          </a>
          <button type="button" onClick={() => setTxResult(null)} className="text-text-muted text-sm hover:text-text-primary">Send another</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <div className="text-text-primary font-heading font-semibold">Send</div>
          <div className="text-text-muted text-xs">Solana mainnet · {SWEEP_BPS_DEFAULT / 100}% auto-swept to vault</div>
        </div>
        <button type="button" onClick={() => navigate('/')} className="text-text-muted text-xs hover:text-text-primary">Cancel</button>
      </div>

      <div className="p-4 space-y-3">
        {!hasKeypair && (
          <div className="flex items-start gap-2 rounded-2xl border p-3 text-xs text-warning"
            style={{ background: 'rgba(255,184,77,0.06)', borderColor: 'rgba(255,184,77,0.2)' }}>
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Wallet is locked. Import your wallet or create a new one to sign transactions.</span>
          </div>
        )}

        {/* Token + amount */}
        <div className="rounded-3xl helio-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-text-muted text-xs uppercase tracking-wider">You send</span>
            <button type="button" onClick={() => setAmount(String(token?.balance ?? 0))}
              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-accent-primary hover:opacity-80"
              style={{ background: 'rgba(198,240,0,0.1)' }}>
              MAX
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button type="button"
              className="flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium text-text-primary"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
              <div className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-accent-primary-foreground shrink-0"
                style={{ background: 'var(--accent-primary)' }}>S</div>
              SOL
              <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
            </button>
            <input inputMode="decimal" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
              className="flex-1 bg-transparent text-right text-3xl font-heading font-semibold text-text-primary outline-none placeholder:text-text-muted" />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
            <span>Balance: {(token?.balance ?? 0).toFixed(4)} SOL</span>
            <span>≈ ${fiatValue.toFixed(2)}</span>
          </div>
        </div>

        {/* Recipient */}
        <div className="rounded-3xl helio-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-text-muted text-xs uppercase tracking-wider">Recipient</span>
            <button type="button" onClick={() => navigate('/settings/address-book')}
              className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary">
              <BookOpen className="h-3.5 w-3.5" />Address book
            </button>
          </div>
          <input type="text" placeholder="Wallet address or .sol domain"
            value={recipient} onChange={e => setRecipient(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-mono text-text-primary outline-none placeholder:text-text-muted"
            style={{ background: 'var(--surface-2)', borderColor: recipient && !recipientValid ? 'var(--danger)' : 'var(--border-subtle)' }} />
          {recipient && !recipientValid && (
            <p className="text-xs text-danger mt-1.5">Enter a valid Solana address or .sol domain.</p>
          )}
        </div>

        {/* Fee summary */}
        <div className="rounded-3xl helio-card p-5 space-y-2.5">
          {[
            { label: 'Network fee',    value: '~0.000005 SOL', sub: '≈ $0.001' },
            { label: 'Vault round-up', value: `+${sweepSol.toFixed(6)} SOL`, accent: true,
              sub: `${SWEEP_BPS_DEFAULT / 100}% of send amount` },
            { label: "You'll send",    value: `${numericAmount.toFixed(4)} SOL`, bold: true },
          ].map(({ label, value, sub, accent, bold }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-text-muted text-xs">{label}</span>
              <div className="text-right">
                <div className={cn('text-sm', accent ? 'text-accent-primary font-medium' : bold ? 'text-text-primary font-semibold' : 'text-text-secondary')}>{value}</div>
                {sub && <div className="text-text-muted text-xs">{sub}</div>}
              </div>
            </div>
          ))}
        </div>

        {insufficient && (
          <div className="flex items-start gap-2 rounded-2xl border p-3 text-xs text-danger"
            style={{ background: 'rgba(255,59,63,0.08)', borderColor: 'rgba(255,59,63,0.25)' }}>
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Insufficient balance.</span>
          </div>
        )}

        {txError && (
          <div className="flex items-start gap-2 rounded-2xl border p-3 text-xs text-danger"
            style={{ background: 'rgba(255,59,63,0.08)', borderColor: 'rgba(255,59,63,0.25)' }}>
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="break-all">{txError}</span>
          </div>
        )}

        <button type="button" onClick={handleSend} disabled={!valid}
          className={cn('flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold transition-colors',
            valid ? 'bg-accent-primary text-accent-primary-foreground hover:bg-accent-primary-hover' : 'text-text-muted cursor-not-allowed')}
          style={!valid ? { background: 'var(--surface-3)' } : {}}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? 'Sending…' : !hasKeypair ? 'Wallet locked' : valid ? 'Send & sweep' : 'Enter amount and recipient'}
        </button>
      </div>
    </div>
  )
}
