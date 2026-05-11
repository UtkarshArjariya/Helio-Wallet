import { cn } from '../../../lib/utils'

export type TokenLike = {
  symbol: string
  iconBg?: string
  iconFg?: string
}

/** Pull a stable color pair from a symbol when explicit ones aren't provided. */
function colorFor(symbol: string): { bg: string; fg: string } {
  switch (symbol.toUpperCase()) {
    case 'SOL':  return { bg: 'var(--gradient-cosmic)',          fg: '#FFFFFF' }
    case 'USDC': return { bg: '#2775CA',                         fg: '#FFFFFF' }
    case 'JUP':  return { bg: '#22C55E',                         fg: '#06210F' }
    case 'JTO':  return { bg: '#1A1FB8',                         fg: '#FFFFFF' }
    case 'PYTH': return { bg: '#1F2937',                         fg: '#C6F000' }
    case 'BONK': return { bg: '#FF3B3F',                         fg: '#FFFFFF' }
    default:     return { bg: 'var(--accent-primary)',           fg: '#000000' }
  }
}

export function TokenIcon({
  token, size = 36, className,
}: { token: TokenLike; size?: number; className?: string }) {
  const c = colorFor(token.symbol)
  return (
    <div
      className={cn('flex items-center justify-center rounded-full font-semibold shrink-0', className)}
      style={{
        width: size, height: size,
        background: token.iconBg ?? c.bg,
        color: token.iconFg ?? c.fg,
        fontSize: size * 0.36,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
      }}
      aria-hidden="true"
    >
      {token.symbol.slice(0, 1)}
    </div>
  )
}
