import React, { useEffect, useState } from 'react'
import {
  AlertTriangle, ArrowRight, Check, Copy, Download, Eye, EyeOff, ShieldAlert,
} from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { useRouter } from '../contexts/RouterContext'
import {
  clearOnboardingMode, clearPendingPhrase, getPendingPhrase,
} from '../lib/helio-program'

export function SeedPhraseScreen() {
  const { navigate } = useRouter()
  const [phrase, setPhrase] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  useEffect(() => {
    const p = getPendingPhrase()
    if (!p) {
      // No phrase pending — user shouldn't be here. Send them home.
      navigate('/')
      return
    }
    setPhrase(p)
  }, [navigate])

  if (!phrase) return null
  const words = phrase.split(/\s+/)

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(phrase) } catch { /* ignore */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDownload = () => {
    const stamp = new Date().toISOString().slice(0, 10)
    const body = [
      'Helio Wallet — Recovery phrase',
      '',
      `Date: ${stamp}`,
      '',
      'KEEP THIS PHRASE SECRET.',
      'Anyone with these 12 words can take everything in this wallet.',
      'Helio cannot recover lost phrases.',
      '',
      ...words.map((w, i) => `${String(i + 1).padStart(2, '0')}  ${w}`),
      '',
    ].join('\n')

    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `helio-recovery-${stamp}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setDownloaded(true)
  }

  const handleContinue = () => {
    clearPendingPhrase()
    clearOnboardingMode()
    navigate('/')
  }

  return (
    <div className="animate-in fade-in duration-500 max-w-md mx-auto h-full flex flex-col pt-4 px-4 space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/15 text-warning">
          <ShieldAlert className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="font-heading text-lg font-bold leading-tight">Recovery phrase</h2>
          <p className="text-text-muted text-xs">12 words that restore your wallet on any device.</p>
        </div>
      </div>

      {/* Phrase card with reveal-to-show */}
      <Card className="overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="relative rounded-2xl border p-3"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
            <div className="grid grid-cols-3 gap-2">
              {words.map((w, i) => (
                <div key={i}
                  className="flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm font-mono"
                  style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}>
                  <span className="text-text-muted text-[10px] w-4 shrink-0 select-none">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-text-primary truncate">
                    {revealed ? w : '••••••'}
                  </span>
                </div>
              ))}
            </div>

            {/* Reveal overlay */}
            {!revealed && (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl backdrop-blur-sm transition-opacity"
                style={{ background: 'rgba(0,0,0,0.55)' }}
              >
                <Eye className="h-5 w-5 text-accent-primary" />
                <span className="text-sm font-medium text-text-primary">Tap to reveal</span>
                <span className="text-text-muted text-[11px]">Make sure no one is watching your screen</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={handleCopy} disabled={!revealed}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-3"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy phrase'}
            </button>
            <button type="button" onClick={handleDownload} disabled={!revealed}
              className="inline-flex items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-accent-primary text-accent-primary-foreground hover:bg-accent-primary-hover">
              {downloaded ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              {downloaded ? 'Saved' : 'Download .txt'}
            </button>
          </div>

          {revealed && (
            <button type="button" onClick={() => setRevealed(false)}
              className="inline-flex w-full items-center justify-center gap-1.5 text-text-muted text-[11px] hover:text-text-primary transition-colors">
              <EyeOff className="h-3 w-3" />
              Hide phrase
            </button>
          )}
        </CardContent>
      </Card>

      {/* Warning */}
      <div className="flex items-start gap-2 rounded-2xl border p-3 text-xs"
        style={{ background: 'rgba(255,184,77,0.06)', borderColor: 'rgba(255,184,77,0.22)', color: 'var(--warning)' }}>
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span className="leading-relaxed">
          Store this phrase somewhere safe and offline. Helio cannot recover it for you. Anyone with this phrase can drain your wallet.
        </span>
      </div>

      {/* Acknowledge + continue */}
      <div className="mt-auto pt-2 pb-6 space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" id="ack"
            className="mt-0.5 h-4 w-4 rounded border-border bg-surface-3 cursor-pointer accent-accent-primary"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            disabled={!revealed}
          />
          <span className="text-sm text-text-secondary leading-relaxed">
            I have saved my recovery phrase in a safe place. I understand it cannot be recovered if lost.
          </span>
        </label>

        <Button className="w-full" disabled={!acknowledged || !revealed} onClick={handleContinue}>
          <span className="inline-flex items-center gap-1.5">
            Open wallet <ArrowRight className="h-4 w-4" />
          </span>
        </Button>
      </div>
    </div>
  )
}
