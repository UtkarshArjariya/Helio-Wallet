import React, { useState } from 'react'
import { ArrowLeft, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { useRouter } from '../contexts/RouterContext'
import {
  keypairFromBase58,
  setPendingSecretKeyBase58,
} from '../lib/helio-program'

/**
 * Import a Solana wallet from a base58-encoded private key — the format
 * Phantom (and our own ExportPrivateKeyScreen) produces. We validate by
 * actually decoding to a Keypair so the user can't proceed with garbage,
 * then stash the raw base58 string for `/create-password` to pick up.
 *
 * No phrase is recoverable from a raw key, so the resulting vault stores
 * `phrase: null` — Settings → "Export recovery phrase" will be disabled
 * for such wallets.
 */
export function ImportPrivateKeyScreen() {
  const { navigate } = useRouter()

  const [value, setValue] = useState('')
  const [reveal, setReveal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewAddress, setPreviewAddress] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function tryParse(v: string): void {
    setError(null)
    const cleaned = v.trim()
    if (cleaned.length === 0) {
      setPreviewAddress(null)
      return
    }
    try {
      const kp = keypairFromBase58(cleaned)
      setPreviewAddress(kp.publicKey.toBase58())
    } catch (e: any) {
      setPreviewAddress(null)
      // Don't surface every transient parse error while user is typing — only
      // when they hit Continue.
    }
  }

  const handleChange = (v: string) => {
    setValue(v)
    tryParse(v)
  }

  const handleContinue = () => {
    setBusy(true)
    setError(null)
    try {
      // Validates by actually constructing the keypair.
      const kp = keypairFromBase58(value)
      setPendingSecretKeyBase58(value.trim())
      // Eager preview so the next screen knows what it's encrypting.
      setPreviewAddress(kp.publicKey.toBase58())
      navigate('/create-password')
    } catch (e: any) {
      setError(e?.message ?? 'Invalid private key.')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto h-full flex flex-col pt-4">
      <div className="flex items-center gap-4 mb-2 px-4">
        <button onClick={() => navigate('/welcome')}
          className="p-2 -ml-2 rounded-full hover:bg-surface-3 transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h2 className="font-heading text-xl font-bold">Import private key</h2>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col mx-4">
        <CardContent className="p-6 md:p-8 flex-1 flex flex-col space-y-6 overflow-y-auto">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="font-heading font-bold text-lg">Paste your Solana private key</h3>
            <p className="text-sm text-text-muted">
              Base58 string from Phantom (Settings → Manage Accounts → Show Private Key) or
              any other Solana wallet. Don't paste your recovery phrase here — use the
              recovery-phrase import for that.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-muted">Private key</label>
            <div className="relative">
              <textarea
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="3pMD…Py1s"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                rows={4}
                className="w-full rounded-2xl border px-4 py-3 text-sm font-mono bg-surface-1 outline-none placeholder:text-text-muted resize-none"
                style={{
                  borderColor: error ? 'var(--danger)' : 'var(--border-subtle)',
                  WebkitTextSecurity: reveal ? 'none' : 'disc',
                } as React.CSSProperties}
              />
              <button
                type="button"
                onClick={() => setReveal(v => !v)}
                className="absolute right-3 top-3 text-text-muted hover:text-text-primary transition-colors"
                aria-label={reveal ? 'Hide key' : 'Reveal key'}
              >
                {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {previewAddress && (
              <div className="rounded-xl px-3 py-2 text-xs"
                style={{ background: 'rgba(198,240,0,0.06)', boxShadow: 'inset 0 0 0 1px rgba(198,240,0,0.18)' }}>
                <div className="font-eyebrow text-[10px] text-text-muted tracking-wider">
                  ADDRESS
                </div>
                <div className="font-mono text-text-primary text-[11px] break-all mt-0.5">
                  {previewAddress}
                </div>
              </div>
            )}
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
                Never share your private key. Anyone with this key controls every asset on
                this wallet. Imported keys can't reconstruct a recovery phrase — back up
                the key string itself somewhere safe.
              </p>
            </div>
            <Button className="w-full"
              onClick={handleContinue}
              disabled={value.trim().length === 0 || busy}>
              {busy ? 'Working…' : previewAddress ? 'Continue' : 'Validate & continue'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
