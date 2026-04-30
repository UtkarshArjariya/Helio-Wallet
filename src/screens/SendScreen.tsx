import React, { useState } from 'react'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useRouter } from '../contexts/RouterContext'
import { useWallet } from '../contexts/WalletContext'

export function SendScreen() {
  const { navigate } = useRouter()
  const { tokens } = useWallet()
  const [amount, setAmount] = useState('')
  const [address, setAddress] = useState('')

  const solToken = tokens.find(t => t.id === 'sol')

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-surface-2 transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h2 className="font-heading text-xl font-bold">Send Token</h2>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-muted">Recipient Address</label>
            <Input 
              placeholder="Paste Solana address" 
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <label className="text-sm font-medium text-text-muted">Amount</label>
              <span className="text-xs text-text-muted">Available: {solToken?.balance} SOL</span>
            </div>
            <div className="relative">
              <Input 
                type="number" 
                placeholder="0.00" 
                className="pr-20 text-lg"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button 
                  className="text-xs font-bold bg-surface-3 px-2 py-1 rounded hover:text-text-primary text-text-muted"
                  onClick={() => setAmount(solToken?.balance.toString() || '0')}
                >
                  MAX
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text-muted">Network Fee</span>
              <span>~0.000005 SOL</span>
            </div>
            <Button 
              className="w-full mt-4 gap-2" 
              disabled={!amount || !address}
            >
              <ArrowUpRight className="h-5 w-5" />
              Send Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
