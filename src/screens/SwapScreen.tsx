import React, { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ChevronDown, Loader2, AlertTriangle, CheckCircle, ExternalLink, Globe } from 'lucide-react'
import { PublicKey } from '@solana/web3.js'
import { useWallet } from '../contexts/WalletContext'
import type { JupiterQuote } from '@helio/api'
import { cn } from '../lib/utils'
import { ScreenHeader } from '../components/wallet/ui/ScreenHeader'
import { TokenIcon } from '../components/wallet/ui/TokenIcon'
import { swapConnection, jupiterSwapClient, jupiterTokensClient } from '../lib/rpc-service'

const SLIPPAGE_BPS = 50 // 0.5%

interface SwapToken { mint: string; symbol: string; name: string; decimals: number; icon?: string | null }

const SOL: SwapToken  = { mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL',  name: 'Solana',    decimals: 9 }
const USDC: SwapToken = { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', name: 'USD Coin', decimals: 6 }

/** Parse a decimal display string to an atomic-unit integer string (BigInt — no float). */
function toAtomic(display: string, decimals: number): string | null {
  if (!/^\d*\.?\d*$/.test(display) || display === '' || display === '.') return null
  const [whole, frac = ''] = display.split('.')
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals)
  try {
    return (BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(fracPadded || '0')).toString()
  } catch { return null }
}

/** Atomic string → display number (presentation only). */
function fromAtomic(atomic: string, decimals: number): number {
  return Number(atomic) / 10 ** decimals
}

export function SwapScreen() {
  const { fullAddress, hasKeypair, executeSwap } = useWallet()

  const [sellToken, setSellToken] = useState<SwapToken>(SOL)
  const [buyToken,  setBuyToken]  = useState<SwapToken>(USDC)
  const [sellAmount, setSellAmount] = useState('')
  const [balance, setBalance] = useState<number | null>(null)
  const [quote, setQuote] = useState<JupiterQuote | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ sig: string; url: string } | null>(null)
  const [picker, setPicker] = useState<'sell' | 'buy' | null>(null)

  // Fetch the MAINNET balance for the input token (swaps run on mainnet).
  const refreshBalance = useCallback(async () => {
    if (!fullAddress) { setBalance(null); return }
    try {
      const owner = new PublicKey(fullAddress)
      if (sellToken.mint === SOL.mint) {
        const lamports = await swapConnection.getBalance(owner)
        setBalance(lamports / 1e9)
      } else {
        const res = await swapConnection.getParsedTokenAccountsByOwner(owner, { mint: new PublicKey(sellToken.mint) })
        const ui = res.value[0]?.account.data.parsed?.info?.tokenAmount?.uiAmount
        setBalance(typeof ui === 'number' ? ui : 0)
      }
    } catch { setBalance(null) }
  }, [fullAddress, sellToken.mint])

  useEffect(() => { void refreshBalance() }, [refreshBalance])

  // Debounced quote.
  useEffect(() => {
    setError(null)
    const atomic = toAtomic(sellAmount, sellToken.decimals)
    if (!atomic || atomic === '0' || sellToken.mint === buyToken.mint) { setQuote(null); setQuoting(false); return }
    let cancelled = false
    setQuoting(true)
    const handle = setTimeout(async () => {
      try {
        const q = await jupiterSwapClient.getQuote({
          inputMint: sellToken.mint, outputMint: buyToken.mint, amountAtomic: atomic, slippageBps: SLIPPAGE_BPS,
        })
        if (!cancelled) setQuote(q)
      } catch (e: any) {
        if (!cancelled) { setQuote(null); setError(e?.message ? `Quote failed: ${e.message}` : 'Could not fetch a quote.') }
      } finally {
        if (!cancelled) setQuoting(false)
      }
    }, 400)
    return () => { cancelled = true; clearTimeout(handle) }
  }, [sellAmount, sellToken, buyToken])

  const outDisplay = quote ? fromAtomic(quote.outAmount, buyToken.decimals) : 0
  const minReceived = quote ? fromAtomic(quote.otherAmountThreshold, buyToken.decimals) : 0
  const impact = quote ? parseFloat(quote.priceImpactPct) * 100 : 0
  const numericSell = parseFloat(sellAmount) || 0
  const insufficient = balance !== null && numericSell > balance
  const canSwap = hasKeypair && quote !== null && !quoting && !executing && !insufficient && numericSell > 0

  const flip = () => { setSellToken(buyToken); setBuyToken(sellToken); setSellAmount(''); setQuote(null) }

  const handleSwap = async () => {
    if (!canSwap || !quote) return
    setExecuting(true); setError(null); setResult(null)
    try {
      const r = await executeSwap(quote)
      setResult({ sig: r.signature, url: r.explorerUrl })
      setSellAmount(''); setQuote(null)
      await refreshBalance()
    } catch (e: any) {
      setError(e?.message ?? 'Swap failed.')
    } finally { setExecuting(false) }
  }

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Swap" subtitle="Best route across Jupiter" />

      <div className="p-4 space-y-2">
        {/* Mainnet notice */}
        <div className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs"
          style={{ background: 'rgba(26,31,184,0.08)', borderColor: 'rgba(26,31,184,0.25)', color: 'var(--text-secondary)' }}>
          <Globe className="h-3.5 w-3.5 shrink-0 text-accent-secondary" />
          <span>Swaps run on <span className="font-semibold text-text-primary">Mainnet</span> (Jupiter liquidity). Balances below are your mainnet balances.</span>
        </div>

        {/* Sell */}
        <SwapCard label="You sell" token={sellToken} amount={sellAmount} balance={balance}
          onAmountChange={setSellAmount} onPickToken={() => setPicker('sell')} showMax />

        <div className="relative -my-2 flex items-center justify-center z-10">
          <button type="button" onClick={flip} aria-label="Switch direction"
            className="flex h-9 w-9 items-center justify-center rounded-full border text-text-primary hover:bg-surface-4 transition-colors"
            style={{ background: 'var(--surface-3)', borderColor: 'var(--border-subtle)', outline: '4px solid var(--bg)' }}>
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>

        {/* Buy */}
        <SwapCard label="You receive (est.)" token={buyToken}
          amount={quote ? outDisplay.toLocaleString('en-US', { maximumFractionDigits: 6 }) : ''}
          readOnly loading={quoting} onPickToken={() => setPicker('buy')} />
      </div>

      {/* Quote details */}
      {quote && (
        <div className="px-4 pt-2">
          <div className="rounded-2xl helio-card p-4 space-y-2 text-xs">
            <Row label="Rate" value={`1 ${sellToken.symbol} ≈ ${(outDisplay / (numericSell || 1)).toLocaleString('en-US', { maximumFractionDigits: 6 })} ${buyToken.symbol}`} />
            <Row label="Minimum received" value={`${minReceived.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${buyToken.symbol}`} />
            <Row label="Price impact" value={`${impact.toFixed(2)}%`} accent={impact >= 1 ? (impact >= 5 ? 'danger' : 'warn') : undefined} />
            <Row label="Slippage" value={`${SLIPPAGE_BPS / 100}%`} />
            {quote.routeLabels.length > 0 && (
              <Row label="Route" value={quote.routeLabels.join(' → ')} />
            )}
          </div>
        </div>
      )}

      <div className="p-4 space-y-2">
        {result && (
          <a href={result.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-2xl border p-3 text-xs text-success"
            style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)' }}>
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">Swap confirmed · {result.sig.slice(0, 16)}…</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </a>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-2xl border p-3 text-xs text-danger"
            style={{ background: 'rgba(255,59,63,0.08)', borderColor: 'rgba(255,59,63,0.25)' }}>
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        )}

        <button type="button" onClick={handleSwap} disabled={!canSwap}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold transition-colors',
            canSwap ? 'bg-accent-primary text-accent-primary-foreground hover:bg-accent-primary-hover' : 'text-text-muted cursor-not-allowed',
          )}
          style={!canSwap ? { background: 'var(--surface-3)' } : {}}>
          {executing && <Loader2 className="h-4 w-4 animate-spin" />}
          {!hasKeypair ? 'Wallet locked'
            : numericSell <= 0 ? 'Enter an amount'
            : sellToken.mint === buyToken.mint ? 'Select different tokens'
            : insufficient ? 'Insufficient balance'
            : quoting ? 'Fetching quote…'
            : executing ? 'Swapping…'
            : !quote ? 'No route'
            : `Swap ${sellToken.symbol} → ${buyToken.symbol}`}
        </button>
      </div>

      {picker && (
        <TokenPicker
          excludeMint={picker === 'sell' ? buyToken.mint : sellToken.mint}
          onClose={() => setPicker(null)}
          onSelect={(t) => { if (picker === 'sell') setSellToken(t); else setBuyToken(t); setPicker(null); setQuote(null) }}
        />
      )}
    </div>
  )
}

function Row({ label, value, accent }: { label: string; value: string; accent?: 'warn' | 'danger' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-muted">{label}</span>
      <span className={cn('font-mono font-medium',
        accent === 'danger' ? 'text-danger' : accent === 'warn' ? 'text-warning' : 'text-text-secondary')}>{value}</span>
    </div>
  )
}

function SwapCard({
  label, token, amount, balance, onAmountChange, onPickToken, readOnly, showMax, loading,
}: {
  label: string; token: SwapToken; amount: string; balance?: number | null
  onAmountChange?: (v: string) => void; onPickToken: () => void
  readOnly?: boolean; showMax?: boolean; loading?: boolean
}) {
  return (
    <div className="rounded-3xl helio-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-eyebrow text-text-muted text-[10px]">{label}</span>
        {balance != null && (
          <span className="text-text-muted text-xs">
            Balance: <span className="text-text-secondary font-mono">{balance.toLocaleString('en-US', { maximumFractionDigits: 6 })}</span>
            {showMax && onAmountChange && balance > 0 && (
              <button type="button" onClick={() => onAmountChange(String(balance))}
                className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold text-accent-primary hover:opacity-80"
                style={{ background: 'rgba(198,240,0,0.12)' }}>MAX</button>
            )}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onPickToken}
          className="flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-3 transition-colors shrink-0"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
          <TokenIcon token={{ symbol: token.symbol, iconUrl: token.icon }} size={24} />
          {token.symbol}
          <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
        </button>
        {loading ? (
          <div className="flex-1 flex justify-end"><Loader2 className="h-5 w-5 animate-spin text-text-muted" /></div>
        ) : (
          <input inputMode="decimal" placeholder="0.00" readOnly={readOnly} value={amount}
            onChange={e => onAmountChange?.(e.target.value)}
            className={cn('flex-1 bg-transparent text-right font-figure text-3xl font-bold outline-none placeholder:text-text-muted',
              readOnly ? 'text-text-secondary' : 'text-text-primary')} />
        )}
      </div>
    </div>
  )
}

function TokenPicker({
  excludeMint, onClose, onSelect,
}: { excludeMint: string; onClose: () => void; onSelect: (t: SwapToken) => void }) {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<SwapToken[]>([SOL, USDC])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setRows([SOL, USDC].filter(t => t.mint !== excludeMint)); return }
    let cancelled = false
    setSearching(true)
    const handle = setTimeout(async () => {
      try {
        const res = await jupiterTokensClient.searchTokens(q)
        if (cancelled) return
        setRows(res
          .filter(r => r.mint !== excludeMint)
          .slice(0, 25)
          .map(r => ({ mint: r.mint, symbol: r.symbol || r.mint.slice(0, 4), name: r.name || 'Token', decimals: r.decimals, icon: r.icon })))
      } finally { if (!cancelled) setSearching(false) }
    }, 250)
    return () => { cancelled = true; clearTimeout(handle) }
  }, [query, excludeMint])

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl helio-card p-4" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-text-primary font-heading font-semibold">Select token</span>
          <button type="button" onClick={onClose} className="text-text-muted text-xs hover:text-text-primary">Close</button>
        </div>
        <input type="text" placeholder="Search name or paste mint" value={query} onChange={e => setQuery(e.target.value)}
          className="w-full rounded-2xl border px-4 py-3 text-sm text-text-primary outline-none placeholder:text-text-muted"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }} />
        <div className="mt-3 max-h-[50vh] overflow-y-auto helio-scrollbar space-y-0.5">
          {searching && <div className="flex items-center justify-center gap-2 py-6 text-text-muted text-xs"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…</div>}
          {rows.map(t => (
            <button key={t.mint} type="button" onClick={() => onSelect(t)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-3 transition-colors text-left">
              <TokenIcon token={{ symbol: t.symbol, iconUrl: t.icon }} size={32} />
              <div className="flex-1 min-w-0">
                <div className="text-text-primary font-medium text-sm">{t.name}</div>
                <div className="text-text-muted text-xs font-mono truncate">{t.symbol} · {t.mint.slice(0, 4)}…{t.mint.slice(-4)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
