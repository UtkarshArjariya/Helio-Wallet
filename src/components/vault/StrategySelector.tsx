import React from 'react'
import { CheckCircle2, Shield, Zap, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { useWallet } from '../../contexts/WalletContext'
import { cn } from '../../lib/utils'

const strategies = [
  {
    id: "Helio Validator",
    title: "Helio Validator",
    type: "Native Staking",
    apy: "7.1%",
    risk: "Low risk",
    icon: Shield,
    color: "text-accent-primary bg-accent-primary/10"
  },
  {
    id: "Liquid Staking",
    title: "Solana Liquid Staking",
    type: "Liquid Token",
    apy: "8.0%",
    risk: "Medium risk",
    icon: Zap,
    color: "text-info bg-info/10"
  },
  {
    id: "Stable Yield",
    title: "Stable Yield Vault",
    type: "DeFi Protocol",
    apy: "9.2%",
    risk: "Medium risk",
    icon: TrendingUp,
    color: "text-success bg-success/10"
  }
]

export function StrategySelector() {
  const { vault, updateVault } = useWallet()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deployment Strategy</CardTitle>
        <CardDescription>Choose where funds go after the threshold is met.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {strategies.map((strategy) => (
          <div 
            key={strategy.id}
            onClick={() => updateVault({ strategy: strategy.id as any })}
            className={cn(
              "flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all",
              vault.strategy === strategy.id 
                ? "border-accent-primary bg-accent-primary/5" 
                : "border-border/50 hover:border-border hover:bg-surface-3"
            )}
          >
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-lg ${strategy.color}`}>
                <strategy.icon className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm">{strategy.title}</h4>
                <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                  <span>{strategy.type}</span>
                  <span>•</span>
                  <span>Est. APY {strategy.apy}</span>
                </div>
              </div>
            </div>
            {vault.strategy === strategy.id && (
              <CheckCircle2 className="h-5 w-5 text-accent-primary" />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
