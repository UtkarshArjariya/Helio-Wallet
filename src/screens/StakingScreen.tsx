import React, { useState } from 'react'
import { Zap, Shield, ChevronDown } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useWallet } from '../contexts/WalletContext'

export function StakingScreen() {
  const { tokens } = useWallet()
  const [amount, setAmount] = useState('')
  
  const solToken = tokens.find(t => t.id === 'sol')

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-xl font-bold flex items-center gap-2">
          <Zap className="h-6 w-6 text-warning" />
          Stake SOL
        </h2>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex justify-between items-center bg-surface-2 p-4 rounded-xl border border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent-primary/10 text-accent-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-sm">Helio Validator</p>
                <p className="text-xs text-success">7.1% APY</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              Change <ChevronDown className="h-3 w-3" />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <label className="text-sm font-medium text-text-muted">Amount to Stake</label>
              <span className="text-xs text-text-muted">Available: {solToken?.balance} SOL</span>
            </div>
            <div className="relative">
              <Input 
                type="number" 
                placeholder="0.00" 
                className="pr-20 text-lg h-14"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <span className="text-text-muted font-bold mr-2">SOL</span>
                <button 
                  className="text-xs font-bold bg-surface-3 px-2 py-1 rounded hover:text-text-primary text-text-muted"
                  onClick={() => setAmount(solToken?.balance.toString() || '0')}
                >
                  MAX
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Est. Annual Return</span>
              <span className="font-bold text-success">
                +{(Number(amount || 0) * 0.071).toFixed(4)} SOL
              </span>
            </div>
            <Button className="w-full mt-4" disabled={!amount}>
              Stake Now
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <p className="text-xs text-center text-text-muted">
        Staking involves locking up SOL to secure the network. It takes ~2-3 days to unstake.
      </p>
    </div>
  )
}
