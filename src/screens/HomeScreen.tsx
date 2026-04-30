import React from 'react'
import { ArrowDownLeft, ArrowUpRight, Repeat, Zap, Orbit, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { useWallet } from '../contexts/WalletContext'
import { useRouter } from '../contexts/RouterContext'

export function HomeScreen() {
  const { totalBalanceUsd, tokens, vault } = useWallet()
  const { navigate } = useRouter()

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero Balance Card */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-b from-surface-2 to-surface-1">
        <div className="absolute inset-0 bg-gradient-solar opacity-5" />
        <CardContent className="p-8 flex flex-col items-center justify-center text-center relative z-10">
          <p className="text-sm font-medium text-text-muted mb-2 tracking-widest uppercase">Total Balance</p>
          <h2 className="text-5xl font-heading font-bold tracking-tight mb-2">
            ${totalBalanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h2>
          <div className="flex items-center gap-2 text-success bg-success/10 px-3 py-1 rounded-full text-sm font-medium mb-8">
            <ArrowUpRight className="h-4 w-4" />
            +2.4% ($14.20)
          </div>

          <div className="grid grid-cols-4 gap-4 w-full max-w-sm">
            <ActionIcon icon={ArrowDownLeft} label="Deposit" onClick={() => navigate('/receive')} />
            <ActionIcon icon={ArrowUpRight} label="Send" onClick={() => navigate('/send')} />
            <ActionIcon icon={Repeat} label="Swap" onClick={() => navigate('/swap')} />
            <ActionIcon icon={Zap} label="Stake" onClick={() => navigate('/staking')} />
          </div>
        </CardContent>
      </Card>

      {/* Vault Widget */}
      <Card className="border border-accent-primary/20 bg-surface-2 hover:bg-surface-3 transition-colors cursor-pointer" onClick={() => navigate('/vault')}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary/10 text-accent-primary">
              <Orbit className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-heading font-bold">Helio Vault</h3>
              <p className="text-sm text-text-muted">
                {vault.balance} SOL • {(vault.balance / vault.threshold * 100).toFixed(0)}% to auto-stake
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block mr-2">
              <p className="text-sm font-bold text-success">Est. {vault.isActive ? "7.1% APY" : "Inactive"}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-text-muted" />
          </div>
        </CardContent>
      </Card>

      {/* Assets List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-bold text-lg">Assets</h3>
        </div>
        <div className="space-y-2">
          {tokens.map((token) => (
            <Card key={token.id} className="bg-surface-1 border-border/50 hover:bg-surface-2 transition-colors">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-surface-3 flex items-center justify-center font-bold text-sm">
                    {token.symbol[0]}
                  </div>
                  <div>
                    <h4 className="font-bold">{token.name}</h4>
                    <p className="text-sm text-text-muted">{token.balance} {token.symbol}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">${(token.balance * token.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  <p className={token.change24h >= 0 ? "text-success text-sm" : "text-danger text-sm"}>
                    {token.change24h >= 0 ? "+" : ""}{token.change24h}%
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

function ActionIcon({ icon: Icon, label, onClick }: { icon: any, label: string, onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group">
      <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-surface-3 text-text-primary group-hover:bg-accent-primary group-hover:text-accent-primary-foreground transition-all duration-300">
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
      <span className="text-xs font-medium text-text-muted group-hover:text-text-primary transition-colors">{label}</span>
    </button>
  )
}
