import React, { useState } from 'react'
import {
  AlertTriangle, ArrowLeft, Check, Copy, Download, Eye, EyeOff,
  Loader2, Lock, ShieldAlert,
} from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { ScreenHeader } from './ui/ScreenHeader'
import { useRouter } from '../../contexts/RouterContext'
import { decryptVault, loadEncryptedVault, type DecryptedSecrets } from '../../lib/vault-crypto'
import { cn } from '../../lib/utils'

type Stage = 'verify' | 'reveal' | 'done'

interface Props {
  /** Header title — "Recovery phrase" / "Private key". */
  title: string
  /** Sentence under the header — describes WHAT is about to be revealed. */
  subtitle: string
  /** Eyebrow text shown on the verify card. */
  intro: string
  /** Body text on the verify card. */
  introBody: string
  /** Pull the secret out of the decrypted vault — return null if not present. */
  extract: (secrets: DecryptedSecrets) => string | null
  /** How to render the revealed value (12-word grid vs single string). */
  render: (value: string, revealed: boolean) => React.ReactNode
  /** Filename for the .txt download. */
  downloadFilename: string
  /** Build the text-file body for download. */
  downloadBody: (value: string) => string
  /** Shown if `extract` returns null (e.g. v1 vault has no phrase). */
  unsupportedHeadline: string
  unsupportedBody: string
}

export function RevealFlow(props: Props) {
  const { navigate } = useRouter()
  const reduce = useReducedMotion()

  const [stage,         setStage]         = useState<Stage>('verify')
  const [password,      setPassword]      = useState('')
  const [showPassword,  setShowPassword]  = useState(false)
  const [verifying,     setVerifying]     = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [revealed,      setRevealed]      = useState(false)
  const [copied,        setCopied]        = useState(false)
  const [downloaded,    setDownloaded]    = useState(false)
  const [acknowledged,  setAcknowledged]  = useState(false)
  const [secretValue,   setSecretValue]   = useState<string | null>(null)
  const [unsupported,   setUnsupported]   = useState(false)

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!password || verifying) return
    const vault = loadEncryptedVault()
    if (!vault) {
      setError('No encrypted vault found on this device.')
      return
    }
    setVerifying(true)
    setError(null)
    try {
      const secrets = await decryptVault(vault, password)
      const value   = props.extract(secrets)
      if (value === null) {
        setUnsupported(true)
        setStage('reveal')
      } else {
        setSecretValue(value)
        setStage('reveal')
      }
    } catch {
      setError('Incorrect password. Try again.')
    } finally {
      setVerifying(false)
    }
  }

  const handleCopy = async () => {
    if (!secretValue) return
    try { await navigator.clipboard.writeText(secretValue) } catch { /* */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDownload = () => {
    if (!secretValue) return
    const body = props.downloadBody(secretValue)
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = props.downloadFilename
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setDownloaded(true)
  }

  const handleDone = () => {
    // Scrub local memory before navigating away.
    setSecretValue(null); setPassword(''); setRevealed(false)
    navigate('/settings')
  }

  return (
    <div className="flex flex-col">
      <ScreenHeader title={props.title} subtitle={props.subtitle} />

      <div className="relative p-4 space-y-4" style={{ isolation: 'isolate' }}>
        {/* Amber warning glow on the right — handle-with-care signal */}
        <div className="pointer-events-none absolute -right-10 top-12 h-56 w-56 rounded-full"
          style={{ background: 'rgba(255,184,77,0.10)', filter: 'blur(70px)', zIndex: -1 }} />

        {/* Stage progress */}
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">
          <span className={cn(stage !== 'verify' && 'text-text-secondary')}>
            01 // Verify
          </span>
          <span className="opacity-30">·</span>
          <span className={cn(stage === 'reveal' && 'text-text-secondary', stage === 'verify' && 'text-text-muted/40')}>
            02 // Reveal
          </span>
          <span className="opacity-30">·</span>
          <span className={cn(stage === 'done' && 'text-text-secondary', stage !== 'done' && 'text-text-muted/40')}>
            03 // Acknowledge
          </span>
        </div>

        {stage === 'verify' && (
          <motion.form
            onSubmit={handleVerify}
            initial={{ opacity: 0, y: reduce ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-3xl helio-card p-5 space-y-4"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-warning/15 text-warning shrink-0">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-eyebrow text-text-muted text-[10px] mb-1">{props.intro}</div>
                <p className="text-text-primary text-sm leading-relaxed">{props.introBody}</p>
              </div>
            </div>

            <label className="block space-y-1.5">
              <span className="font-eyebrow text-text-muted text-[10px]">Confirm password</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null) }}
                  autoFocus
                  autoComplete="current-password"
                  placeholder="Enter your wallet password"
                  className="w-full rounded-2xl border px-4 py-3 pr-10 text-sm text-text-primary outline-none placeholder:text-text-muted transition-colors"
                  style={{
                    background: 'var(--surface-2)',
                    borderColor: error ? 'var(--danger)' : 'var(--border-subtle)',
                  }}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && (
                <span className="flex items-center gap-1 text-danger text-[11px]">
                  <AlertTriangle className="h-3 w-3" />
                  {error}
                </span>
              )}
            </label>

            <button type="submit"
              disabled={verifying || !password}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition-colors',
                verifying || !password
                  ? 'text-text-muted cursor-not-allowed'
                  : 'bg-warning text-black hover:opacity-90',
              )}
              style={verifying || !password ? { background: 'var(--surface-3)' } : {}}
            >
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {verifying ? 'Verifying…' : 'Continue'}
            </button>
          </motion.form>
        )}

        {stage === 'reveal' && unsupported && (
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-3xl helio-card p-5 space-y-3"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-warning/15 text-warning shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-heading text-text-primary text-base font-bold">{props.unsupportedHeadline}</h3>
                <p className="text-text-muted text-xs mt-1 leading-relaxed">{props.unsupportedBody}</p>
              </div>
            </div>
            <button type="button" onClick={() => navigate('/settings')}
              className="w-full rounded-full border py-2.5 text-sm font-medium text-text-primary hover:bg-surface-3 transition-colors"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
              Back to settings
            </button>
          </motion.div>
        )}

        {stage === 'reveal' && !unsupported && secretValue && (
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-3xl helio-card p-5 space-y-4"
          >
            <div className="relative">
              {props.render(secretValue, revealed)}
              {!revealed && (
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl backdrop-blur-sm transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.55)' }}
                >
                  <Eye className="h-5 w-5 text-warning" />
                  <span className="text-sm font-medium text-text-primary">Tap to reveal</span>
                  <span className="text-text-muted text-[11px]">Make sure no one can see your screen</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={handleCopy} disabled={!revealed}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-3"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button type="button" onClick={handleDownload} disabled={!revealed}
                className="inline-flex items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-warning text-black hover:opacity-90">
                {downloaded ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {downloaded ? 'Saved' : 'Download .txt'}
              </button>
            </div>

            {revealed && (
              <button type="button" onClick={() => setRevealed(false)}
                className="inline-flex w-full items-center justify-center gap-1.5 text-text-muted text-[11px] hover:text-text-primary transition-colors">
                <EyeOff className="h-3 w-3" />
                Hide
              </button>
            )}

            <label className="flex items-start gap-3 cursor-pointer pt-2 border-t"
              style={{ borderColor: 'var(--border-subtle)' }}>
              <input type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border bg-surface-3 cursor-pointer accent-accent-primary"
                checked={acknowledged}
                onChange={e => setAcknowledged(e.target.checked)}
                disabled={!revealed}
              />
              <span className="text-text-secondary text-xs leading-relaxed">
                I have stored this securely and understand that anyone with it can take everything from my wallet.
              </span>
            </label>

            <button type="button" onClick={handleDone}
              disabled={!acknowledged}
              className={cn(
                'w-full rounded-full py-3 text-sm font-semibold transition-colors',
                acknowledged
                  ? 'bg-accent-primary text-accent-primary-foreground hover:bg-accent-primary-hover'
                  : 'text-text-muted cursor-not-allowed',
              )}
              style={!acknowledged ? { background: 'var(--surface-3)' } : {}}>
              Done
            </button>
          </motion.div>
        )}

        {stage === 'verify' && (
          <button type="button" onClick={() => navigate('/settings')}
            className="inline-flex items-center gap-1 text-text-muted text-xs hover:text-text-primary transition-colors px-1">
            <ArrowLeft className="h-3 w-3" />
            Cancel and return
          </button>
        )}
      </div>
    </div>
  )
}
