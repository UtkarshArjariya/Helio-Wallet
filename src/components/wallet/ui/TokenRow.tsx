import { motion, useReducedMotion } from 'framer-motion'
import { TokenIcon, type TokenLike } from './TokenIcon'
import { cn } from '../../../lib/utils'

export type TokenRowItem = TokenLike & {
  name: string
  balance: number
  price: number
  change24h: number
  fiatValue?: number
}

export function TokenRow({
  token, onClick, className, hideBalance,
}: {
  token: TokenRowItem
  onClick?: () => void
  className?: string
  hideBalance?: boolean
}) {
  const fiat = token.fiatValue ?? token.balance * token.price
  const reduce = useReducedMotion()
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={reduce ? undefined : {
        y: -1,
        boxShadow: '0 4px 16px -8px rgba(198,240,0,0.35), inset 0 0 0 1px rgba(198,240,0,0.18)',
      }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors text-left',
        className,
      )}
    >
      <TokenIcon token={token} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-text-primary font-medium">{token.name}</span>
          <span className="text-text-muted text-xs font-mono">{token.symbol}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-muted font-mono">
            ${token.price.toLocaleString('en-US', {
              minimumFractionDigits: token.price < 1 ? 4 : 2,
              maximumFractionDigits: token.price < 1 ? 6 : 2,
            })}
          </span>
          <span className={cn('font-medium', token.change24h >= 0 ? 'text-success' : 'text-danger')}>
            {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
          </span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-text-primary font-medium font-mono text-sm">
          {hideBalance
            ? '••••'
            : token.balance.toLocaleString('en-US', {
                maximumFractionDigits: token.balance > 1000 ? 0 : 4,
              })}{' '}
          <span className="text-text-muted text-xs">{token.symbol}</span>
        </div>
        <div className="text-text-muted text-xs font-mono">
          {hideBalance ? '••••' : `$${fiat.toFixed(2)}`}
        </div>
      </div>
    </motion.button>
  )
}
