import React, { useState } from 'react'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useRouter } from '../contexts/RouterContext'
import { isValidPhrase, setPendingPhrase } from '../lib/helio-program'

export function ImportWalletScreen() {
  const { navigate } = useRouter()
  const [wordCount, setWordCount] = useState<12 | 24>(12)
  const [words, setWords] = useState<string[]>(Array(12).fill(''))
  const [error, setError] = useState<string | null>(null)

  const handleWordChange = (index: number, value: string) => {
    // Normalise pasted phrases: if user pastes the whole phrase into the first
    // box, split it across all inputs.
    const trimmed = value.trim()
    if (index === 0 && trimmed.split(/\s+/).length >= 12) {
      const pieces = trimmed.toLowerCase().split(/\s+/).slice(0, 24)
      const next = pieces.length > 12 ? 24 : 12
      if (next !== wordCount) setWordCount(next)
      const filled = Array(next).fill('').map((_, i) => pieces[i] ?? '')
      setWords(filled)
      setError(null)
      return
    }
    const newWords = [...words]
    newWords[index] = value.trim().toLowerCase()
    setWords(newWords)
    setError(null)
  }

  const handleToggle = (count: 12 | 24) => {
    setWordCount(count)
    setWords(Array(count).fill(''))
    setError(null)
  }

  const allFilled = words.every(w => w.trim() !== '')
  const valid     = allFilled && isValidPhrase(words.join(' '))

  const handleContinue = () => {
    const phrase = words.map(w => w.trim().toLowerCase()).join(' ')
    if (!isValidPhrase(phrase)) {
      setError('That phrase is not a valid BIP-39 mnemonic. Check the order and spelling.')
      return
    }
    setPendingPhrase(phrase)
    navigate('/create-password')
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto h-full flex flex-col pt-4">
      <div className="flex items-center gap-4 mb-2 px-4">
        <button onClick={() => navigate('/welcome')}
          className="p-2 -ml-2 rounded-full hover:bg-surface-3 transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h2 className="font-heading text-xl font-bold">Import Wallet</h2>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col mx-4">
        <CardContent className="p-6 md:p-8 flex-1 flex flex-col space-y-6 overflow-y-auto">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="font-heading font-bold text-lg">Enter your recovery phrase</h3>
            <p className="text-sm text-text-muted">
              Enter your 12 or 24-word recovery phrase. You can paste the whole phrase into the first box.
            </p>
          </div>

          <div className="flex bg-surface-3 rounded-full p-1 w-full max-w-xs mx-auto md:mx-0">
            {([12, 24] as const).map(c => (
              <button
                key={c}
                onClick={() => handleToggle(c)}
                className={`flex-1 py-2 text-sm font-medium rounded-full transition-colors ${
                  wordCount === c
                    ? 'bg-surface-1 shadow text-text-primary'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {c} Words
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {words.map((word, index) => (
              <div key={index} className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-muted font-mono select-none">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <Input
                  className="pl-9 h-11 text-sm font-mono bg-surface-1 border-border/50"
                  value={word}
                  onChange={(e) => handleWordChange(index, e.target.value)}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </div>
            ))}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-2xl border p-3 text-xs text-danger"
              style={{ background: 'rgba(255,59,63,0.08)', borderColor: 'rgba(255,59,63,0.25)' }}>
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-auto pt-6">
            <div className="p-4 bg-warning/10 rounded-xl border border-warning/20 mb-6">
              <p className="text-xs text-warning leading-relaxed">
                Never share your recovery phrase with anyone. Anyone with this phrase can access your assets.
              </p>
            </div>
            <Button className="w-full" onClick={handleContinue} disabled={!valid}>
              {!allFilled ? 'Enter all words' : valid ? 'Continue' : 'Invalid phrase'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
