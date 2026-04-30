import React, { useState } from 'react'
import { ArrowLeft, Copy, Check } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { useRouter } from '../contexts/RouterContext'
import { useWallet } from '../contexts/WalletContext'

export function ReceiveScreen() {
  const { navigate } = useRouter()
  const { address } = useWallet()
  const [copied, setCopied] = useState(false)

  const fullAddress = "He1ioWv2oB9m82rxV14Jc73kLx1Vp3f2V2Jm48oW9q" // Mock full address

  const handleCopy = () => {
    navigator.clipboard.writeText(fullAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-surface-2 transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h2 className="font-heading text-xl font-bold">Receive Token</h2>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-6">
          <div className="bg-white p-4 rounded-2xl w-48 h-48 flex items-center justify-center">
            {/* Mock QR Code using CSS since we don't have an image/library readily installed for QR generation */}
            <div className="grid grid-cols-6 grid-rows-6 gap-1 w-full h-full">
               {Array.from({length: 36}).map((_, i) => (
                 <div key={i} className={`bg-black ${Math.random() > 0.5 ? 'opacity-100' : 'opacity-0'} rounded-sm`} />
               ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="font-heading font-bold text-lg">Your Solana Address</h3>
            <p className="text-sm font-mono text-text-muted break-all px-4">{fullAddress}</p>
          </div>

          <Button 
            variant="secondary" 
            className="w-full gap-2" 
            onClick={handleCopy}
          >
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy Address"}
          </Button>
          
          <div className="p-4 bg-warning/10 rounded-xl border border-warning/20">
            <p className="text-xs text-warning text-center">
              Only send Solana network assets to this address. Other networks will be lost forever.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
