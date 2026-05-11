import React, { useState } from 'react'
import { ArrowDown, ChevronDown, Settings2 } from 'lucide-react'
import { useWallet, type Token } from '../contexts/WalletContext'
import { cn } from '../lib/utils'
import { ScreenHeader } from '../components/wallet/ui/ScreenHeader'
import { TokenIcon } from '../components/wallet/ui/TokenIcon'

export function SwapScreen() {
  const { tokens } = useWallet()
  const [sellToken, setSellToken] = useState<Token>(tokens[0])
  const [buyToken,  setBuyToken]  = useState<Token>(tokens[1] ?? tokens[0])
  const [sellAmount, setSellAmount] = useState('')
  const [showDetails, setShowDetails] = useState(true)
  const [picker, setPicker] = useState<'sell' | 'buy' | null>(null)

  const sellNum = parseFloat(sellAmount) || 0
  const buyAmt  = sellNum > 0 && sellToken.id !== buyToken.id
    ? (sellNum * (sellToken.price / buyToken.price)).toFixed(4)
    : ''
  const valid = sellNum > 0 && sellNum <= sellToken.balance && sellToken.id !== buyToken.id

  const flip = () => {
    const prev = sellToken
    setSellToken(buyToken)
    setBuyToken(prev)
    setSellAmount('')
  }

  return (
    <div className="flex flex-col">
      <ScreenHeader
        title="Swap"
        subtitle="Best route across Jupiter"
        rightSlot={
          <button
            type="button"
            aria-label="Settings"
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:text-text-primary transition-colors"
            style={{ background: 'var(--surface-2)' }}
          >
            <Settings2 className="h-4 w-4" />
          </button>
        }
      />

      <div className="p-4 space-y-2">
        <SwapCard
          label="You sell"
          token={sellToken}
          amount={sellAmount}
          onAmountChange={setSellAmount}
          showShortcuts
          onPickToken={() => setPicker('sell')}
        />

        <div className="relative -my-2 flex items-center justify-center z-10">
          <button
            type="button"
            onClick={flip}
            aria-label="Switch direction"
            className="flex h-9 w-9 items-center justify-center rounded-full border text-text-primary hover:bg-surface-4 transition-colors"
            style={{
              background: 'var(--surface-3)',
              borderColor: 'var(--border-subtle)',
              outline: '4px solid var(--bg)',
            }}
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>

        <SwapCard
          label="You buy"
          token={buyToken}
          amount={buyAmt}
          readOnly
          onPickToken={() => setPicker('buy')}
        />
      </div>

      <div className="px-4 pt-2 space-y-2">
        <button
          type="button"
          onClick={() => setShowDetails(v => !v)}
          className="flex w-full items-center justify-between rounded-2xl helio-card px-4 py-3 text-sm text-text-secondary hover:bg-surface-3 transition-colors"
        >
          <span>
            1 {sellToken.symbol} ≈{' '}
            <span className="text-text-primary font-medium font-mono">
              {(sellToken.price / buyToken.price).toLocaleString('en-US', { maximumFractionDigits: 4 })}
            </span>{' '}{buyToken.symbol}
          </span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', showDetails && 'rotate-180')} />
        </button>

        {showDetails && (
          <div className="rounded-2xl helio-card p-4 space-y-2 text-xs">
            {[
              { label: 'Best route',         value: 'Jupiter aggregator' },
              { label: 'Network fee',        value: '0.000005 SOL' },
              { label: 'Slippage tolerance', value: '0.5%' },
              { label: 'Vault round-up',     value: '+$0.36 to vault', accent: true },
              { label: 'Min received',       value: buyAmt ? `${(parseFloat(buyAmt) * 0.995).toFixed(4)} ${buyToken.symbol}` : '—' },
            ].map(({ label, value, accent }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-text-muted">{label}</span>
                <span className={cn('font-medium font-mono', accent ? 'text-accent-primary' : 'text-text-secondary')}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4">
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
          {!sellNum
            ? 'Enter an amount'
            : sellToken.id === buyToken.id
              ? 'Select different tokens'
              : sellNum > sellToken.balance
                ? 'Insufficient balance'
                : `Swap ${sellToken.symbol} → ${buyToken.symbol}`}
        </button>
      </div>

      {picker && (
        <TokenSelector
          tokens={tokens}
          excludeId={picker === 'sell' ? buyToken.id : sellToken.id}
          onClose={() => setPicker(null)}
          onSelect={t => {
            if (picker === 'sell') setSellToken(t)
            else                    setBuyToken(t)
            setPicker(null)
          }}
        />
      )}
    </div>
  )
}

function SwapCard({
  label, token, amount, onAmountChange, readOnly, showShortcuts, onPickToken,
}: {
  label: string
  token: Token
  amount: string
  onAmountChange?: (v: string) => void
  readOnly?: boolean
  showShortcuts?: boolean
  onPickToken?: () => void
}) {
  const num  = parseFloat(amount) || 0
  const fiat = num * token.price

  return (
    <div className="rounded-3xl helio-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-eyebrow text-text-muted text-[10px]">{label}</span>
        <span className="text-text-muted text-xs">
          Balance: <span className="text-text-secondary font-medium font-mono">{token.balance.toFixed(4)}</span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPickToken}
          className="flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-3 transition-colors"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
        >
          <TokenIcon token={{ symbol: token.symbol }} size={24} />
          {token.symbol}
          <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
        </button>
        <input
          inputMode="decimal"
          placeholder="0.00"
          readOnly={readOnly}
          value={amount}
          onChange={e => onAmountChange?.(e.target.value)}
          className={cn(
            'flex-1 bg-transparent text-right font-figure text-3xl font-bold outline-none placeholder:text-text-muted',
            readOnly ? 'text-text-secondary' : 'text-text-primary',
          )}
        />
      </div>

      <div className="mt-2 flex items-center justify-between">
        {showShortcuts && onAmountChange ? (
          <div className="flex items-center gap-1">
            {(['25', '50', '75', 'Max'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  const pct = p === 'Max' ? 100 : Number(p)
                  onAmountChange(((token.balance * pct) / 100).toFixed(6))
                }}
                className="rounded-full px-2 py-0.5 text-[11px] font-medium text-text-secondary hover:text-text-primary"
                style={{ background: 'var(--surface-3)' }}
              >
                {p === 'Max' ? p : `${p}%`}
              </button>
            ))}
          </div>
        ) : <div />}
        <div className="text-text-muted text-xs font-mono">≈ ${fiat.toFixed(2)}</div>
      </div>
    </div>
  )
}

function TokenSelector({
  tokens, excludeId, onClose, onSelect,
}: {
  tokens: Token[]
  excludeId: string
  onClose: () => void
  onSelect: (t: Token) => void
}) {
  const [query, setQuery] = useState('')
  const filtered = tokens.filter(t =>
    t.id !== excludeId &&
    (t.symbol.toLowerCase().includes(query.toLowerCase()) || t.name.toLowerCase().includes(query.toLowerCase())),
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl helio-card p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-text-primary font-heading font-semibold">Select token</span>
          <button type="button" onClick={onClose} className="text-text-muted text-xs hover:text-text-primary">
            Close
          </button>
        </div>
        <input
          type="text"
          placeholder="Search tokens"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full rounded-2xl border px-4 py-3 text-sm text-text-primary outline-none placeholder:text-text-muted"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
        />
        <div className="mt-3 max-h-[50vh] overflow-y-auto helio-scrollbar space-y-0.5">
          {filtered.length === 0 ? (
            <div className="py-8 text-center">
              <div className="font-figure text-text-primary/30 text-4xl font-extrabold tabular-nums select-none mb-1">—</div>
              <div className="text-text-primary text-sm font-medium">No tokens match "{query}".</div>
              <div className="text-text-muted text-xs mt-1">Try a different ticker or paste a mint address.</div>
            </div>
          ) : filtered.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-3 transition-colors text-left"
            >
              <TokenIcon token={{ symbol: t.symbol }} size={32} />
              <div className="flex-1 min-w-0">
                <div className="text-text-primary font-medium text-sm">{t.name}</div>
                <div className="text-text-muted text-xs">{t.symbol}</div>
              </div>
              <div className="text-right">
                <div className="text-text-primary text-sm font-mono">
                  {t.balance.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                </div>
                <div className="text-text-muted text-xs font-mono">
                  ${(t.balance * t.price).toFixed(2)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
