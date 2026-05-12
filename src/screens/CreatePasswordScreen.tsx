import React, { useState } from 'react'
import { ArrowLeft, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useRouter } from '../contexts/RouterContext'
import { importKeypairToSession } from '../contexts/WalletContext'
import {
  generateRecoveryPhrase, keypairFromPhrase, keypairFromBase58,
  getOnboardingMode, getPendingPhrase, setPendingPhrase, clearPendingPhrase,
  getPendingSecretKeyBase58, clearPendingSecretKey,
  clearOnboardingMode,
} from '../lib/helio-program'
import { encryptVault, saveEncryptedVault } from '../lib/vault-crypto'

export function CreatePasswordScreen() {
  const { navigate } = useRouter()
  const mode = getOnboardingMode() ?? 'create'

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword
  const isValid = password.length >= 8 && password === confirmPassword && agreed && !pending

  const goBack = () =>
    navigate(
      mode === 'import'      ? '/import'
      : mode === 'import-key' ? '/import-private-key'
      : '/welcome',
    )

  const handleContinue = async () => {
    if (!isValid) return
    setPending(true)
    setError(null)
    try {
      // `phrase` is null for raw private-key imports — no mnemonic is
      // recoverable from a 64-byte ed25519 secret. The vault layer accepts
      // null phrase; the export-recovery-phrase screen handles that case.
      let phrase: string | null
      let keypair: ReturnType<typeof keypairFromPhrase>

      if (mode === 'import') {
        const p = getPendingPhrase()
        if (!p) throw new Error('No recovery phrase found. Please re-enter it.')
        phrase  = p
        keypair = keypairFromPhrase(phrase)
      } else if (mode === 'import-key') {
        const b58 = getPendingSecretKeyBase58()
        if (!b58) throw new Error('No private key found. Please re-enter it.')
        keypair = keypairFromBase58(b58)
        phrase  = null
      } else {
        phrase  = generateRecoveryPhrase()
        keypair = keypairFromPhrase(phrase)
      }

      // Encrypt + persist the keypair (and the recovery phrase when we have
      // one) at rest. The vault survives browser restarts and lets the user
      // later export their phrase / key from Settings.
      const vault = await encryptVault({ secretKey: keypair.secretKey, phrase }, password)
      saveEncryptedVault(vault)

      // Also seed the in-memory session so the user doesn't need to
      // immediately re-unlock after onboarding.
      importKeypairToSession(keypair)

      if (mode === 'import' || mode === 'import-key') {
        clearPendingPhrase()
        clearPendingSecretKey()
        clearOnboardingMode()
        navigate('/')
      } else {
        // Stash phrase so the next screen can show it once.
        if (phrase) setPendingPhrase(phrase)
        navigate('/seed-phrase')
      }
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Try again.')
      setPending(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-md mx-auto h-full flex flex-col pt-4 px-4">
      <div className="flex items-center gap-4 mb-2">
        <button type="button" onClick={goBack}
          className="p-2 -ml-2 rounded-full hover:bg-surface-3 transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h2 className="font-heading text-xl font-bold">Create password</h2>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardContent className="p-6 flex-1 flex flex-col space-y-6">
          <div className="space-y-1">
            <h3 className="font-heading font-bold text-lg">Secure your wallet</h3>
            <p className="text-sm text-text-muted">
              {mode === 'import' || mode === 'import-key'
                ? 'This password unlocks your imported wallet on this device.'
                : 'This password unlocks your wallet on this device only. You will see your 12-word recovery phrase next.'}
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-muted">New password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                  onClick={() => setShowPassword(v => !v)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-muted">Confirm password</label>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={!passwordsMatch ? 'border-danger' : ''}
                autoComplete="new-password"
              />
              {!passwordsMatch && (
                <p className="text-xs text-danger">Passwords don't match.</p>
              )}
            </div>

            <div className="flex items-start gap-3 pt-1">
              <input
                type="checkbox" id="terms"
                className="mt-1 h-4 w-4 rounded border-border bg-surface-3 text-accent-primary cursor-pointer accent-accent-primary"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <label htmlFor="terms" className="text-sm text-text-muted cursor-pointer leading-relaxed">
                I agree to the{' '}
                <span className="text-accent-primary hover:underline cursor-pointer">Terms of Service</span> and{' '}
                <span className="text-accent-primary hover:underline cursor-pointer">Privacy Policy</span>.
              </label>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-2xl border p-3 text-xs text-danger"
              style={{ background: 'rgba(255,59,63,0.08)', borderColor: 'rgba(255,59,63,0.25)' }}>
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-auto pt-4">
            <Button className="w-full" disabled={!isValid} onClick={handleContinue}>
              {pending
                ? 'Working…'
                : mode === 'import' || mode === 'import-key'
                  ? 'Unlock & continue'
                  : 'Create wallet'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
