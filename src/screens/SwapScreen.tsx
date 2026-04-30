import React, { useState } from 'react'
import { ArrowLeft, ArrowDownUp, Settings2 } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useRouter } from '../contexts/RouterContext'
import { useWallet } from '../contexts/WalletContext'

export function SwapScreen() {
  const { navigate } = useRouter()
  const { tokens } = useWallet()
  const [sellAmount, setSellAmount] = useState('')
  const [buyAmount, setBuyAmount] = useState('')
  
  const solToken = tokens.find(t => t.id === 'sol')
  const usdcToken = tokens.find(t => t.id === 'usdc')

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-surface-2 transition-colors">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h2 className="font-heading text-xl font-bold">Swap</h2>
        </div>
        <button className="p-2 rounded-full hover:bg-surface-2 transition-colors text-text-muted">
          <Settings2 className="h-5 w-5" />
        </button>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-4 space-y-2">
          {/* Sell Input */}
          <div className="bg-surface-1 rounded-xl p-4 border border-border/50">
            <div className="flex justify-between text-sm mb-2 text-text-muted">
              <span>You pay</span>
              <span>Bal: {solToken?.balance}</span>
            </div>
            <div className="flex items-center gap-4">
              <Input 
                type="number" 
                placeholder="0.00" 
                className="border-0 bg-transparent p-0 h-10 text-2xl focus-visible:ring-0"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
              />
              <button className="flex items-center gap-2 bg-surface-3 hover:bg-surface-3/80 px-3 py-2 rounded-lg font-bold">
                <div className="h-5 w-5 rounded-full bg-surface-2 flex items-center justify-center text-xs">S</div>
                SOL
              </button>
            </div>
          </div>

          {/* Swap Button */}
          <div className="relative h-4 flex items-center justify-center">
            <div className="absolute border-t border-border w-full"></div>
            <button className="relative z-10 h-10 w-10 bg-surface-2 border border-border rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors">
              <ArrowDownUp className="h-4 w-4" />
            </button>
          </div>

          {/* Buy Input */}
          <div className="bg-surface-1 rounded-xl p-4 border border-border/50">
            <div className="flex justify-between text-sm mb-2 text-text-muted">
              <span>You receive</span>
              <span>Bal: {usdcToken?.balance}</span>
            </div>
            <div className="flex items-center gap-4">
              <Input 
                type="number" 
                placeholder="0.00" 
                className="border-0 bg-transparent p-0 h-10 text-2xl focus-visible:ring-0"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
              />
              <button className="flex items-center gap-2 bg-surface-3 hover:bg-surface-3/80 px-3 py-2 rounded-lg font-bold">
                <div className="h-5 w-5 rounded-full bg-surface-2 flex items-center justify-center text-xs">U</div>
                USDC
              </button>
            </div>
          </div>
          
          <div className="pt-4 px-2 space-y-2 text-sm">
            <div className="flex justify-between text-text-muted">
              <span>Rate</span>
              <span className="text-text-primary">1 SOL = 145.20 USDC</span>
            </div>
            <div className="flex justify-between text-text-muted">
              <span>Network Fee</span>
              <span className="text-text-primary">~0.000005 SOL</span>
            </div>
          </div>

          <Button className="w-full mt-4" disabled={!sellAmount}>
            Review Swap
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
