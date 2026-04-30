import React, { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useRouter } from '../contexts/RouterContext'

export function ImportWalletScreen() {
  const { navigate } = useRouter()
  const [wordCount, setWordCount] = useState<12 | 24>(12)
  const [words, setWords] = useState<string[]>(Array(12).fill(''))

  const handleWordChange = (index: number, value: string) => {
    const newWords = [...words]
    newWords[index] = value
    setWords(newWords)
  }

  const handleToggle = (count: 12 | 24) => {
    setWordCount(count)
    setWords(Array(count).fill(''))
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto h-full flex flex-col pt-4">
      <div className="flex items-center gap-4 mb-2">
        <button onClick={() => navigate('/welcome')} className="p-2 -ml-2 rounded-full hover:bg-surface-2 transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h2 className="font-heading text-xl font-bold">Import Wallet</h2>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardContent className="p-6 md:p-8 flex-1 flex flex-col space-y-6 overflow-y-auto">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="font-bold text-lg">Enter your recovery phrase</h3>
            <p className="text-sm text-text-muted">
              Enter your 12 or 24-word recovery phrase to restore your wallet.
            </p>
          </div>

          <div className="flex bg-surface-3 rounded-lg p-1 w-full max-w-xs mx-auto md:mx-0">
            <button 
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${wordCount === 12 ? 'bg-surface-1 shadow text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
              onClick={() => handleToggle(12)}
            >
              12 Words
            </button>
            <button 
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${wordCount === 24 ? 'bg-surface-1 shadow text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
              onClick={() => handleToggle(24)}
            >
              24 Words
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {words.map((word, index) => (
              <div key={index} className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-muted w-4 text-right select-none">
                  {index + 1}.
                </span>
                <Input 
                  className="pl-9 h-11 text-sm bg-surface-1 border-border/50"
                  value={word}
                  onChange={(e) => handleWordChange(index, e.target.value)}
                />
              </div>
            ))}
          </div>
          
          <div className="mt-auto pt-6">
            <div className="p-4 bg-warning/10 rounded-xl border border-warning/20 mb-6">
              <p className="text-xs text-warning leading-relaxed">
                Never share your recovery phrase with anyone. Anyone with this phrase can access your assets.
              </p>
            </div>
            <Button 
              className="w-full" 
              onClick={() => navigate('/create-password')}
              disabled={words.some(w => w.trim() === '')}
            >
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
