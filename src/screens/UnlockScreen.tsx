import React, { useEffect, useState } from 'react'
import { AlertTriangle, Eye, EyeOff, Loader2, Lock, RotateCcw } from 'lucide-react'
import { Keypair } from '@solana/web3.js'
import { useRouter } from '../contexts/RouterContext'
import { importKeypairToSession } from '../contexts/WalletContext'
import { HelioWordmark, HelioMark } from '../components/ui/HelioLogo'
import { OrbitalPattern } from '../components/wallet/ui/OrbitalPattern'
import {
  decryptSecret, loadEncryptedVault, clearEncryptedVault,
} from '../lib/vault-crypto'
import { clearOnboardingMode, clearPendingPhrase } from '../lib/helio-program'
import { cn } from '../lib/utils'

export function UnlockScreen() {
  const { navigate } = useRouter()
  const [password, setPassword] = useState('')
  const [show, setShow]         = useState(false)
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [vaultMissing, setVaultMissing] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  // Pull the saved wallet label + short address for display
  const label = typeof localStorage !== 'undefined'
    ? localStorage.getItem('helio:label') ?? 'Main Wallet'
    : 'Main Wallet'
  const address = typeof localStorage !== 'undefined'
    ? localStorage.getItem('helio:address') ?? ''
    : ''
  const shortAddress = address.length > 12
    ? `${address.slice(0, 4)}…${address.slice(-4)}`
    : address

  useEffect(() => {
    if (!loadEncryptedVault()) setVaultMissing(true)
  }, [])

  const handleUnlock = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (busy || password.length === 0) return

    const vault = loadEncryptedVault()
    if (!vault) {
      setError('No encrypted vault found on this device. Please restore using your recovery phrase.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const secret = await decryptSecret(vault, password)
      // ed25519 secret keys are 64 bytes (32-byte seed + 32-byte pubkey).
      // The encrypted payload IS the full 64-byte secretKey.
      const keypair = Keypair.fromSecretKey(secret)
      importKeypairToSession(keypair)
      clearOnboardingMode()
      clearPendingPhrase()
      navigate('/', { replace: true })
    } catch {
      setError('Incorrect password. Try again, or use your recovery phrase to restore.')
      setBusy(false)
    }
  }

  const handleResetDevice = () => {
    // Wipe local state and start fresh onboarding. The on-chain wallet is
    // untouched — it can be re-imported with the 12-word phrase.
    localStorage.removeItem('helio:address')
    localStorage.removeItem('helio:label')
    clearEncryptedVault()
    clearOnboardingMode()
    clearPendingPhrase()
    navigate('/welcome', { replace: true })
  }

  return (
    <div className="relative flex min-h-full flex-col items-center justify-between overflow-hidden p-6 helio-orbit-bg"
      style={{ minHeight: '100vh' }}>
      <OrbitalPattern className="pointer-events-none absolute -right-24 -top-16 h-[480px] w-[480px] opacity-40" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-72 w-72 rounded-full"
        style={{ background: 'rgba(26,31,184,0.18)', filter: 'blur(80px)' }} />

      <div className="relative z-10 w-full pt-4 flex justify-center">
        <HelioWordmark size="sm" tone="light" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-5 flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 rounded-3xl opacity-30 blur-2xl"
              style={{ background: 'var(--accent-primary)' }} />
            <div className="relative rounded-3xl overflow-hidden"
              style={{ boxShadow: '0 24px 60px -20px rgba(198,240,0,0.4)' }}>
              <HelioMark size={80} />
            </div>
          </div>

          <span className="font-eyebrow text-text-muted text-[10px] mb-2 inline-flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            Wallet locked
          </span>
          <h1 className="font-heading text-2xl font-bold text-text-primary tracking-tight">
            Welcome back.
          </h1>
          <p className="text-text-muted text-sm mt-1.5">
            Enter your password to unlock <span className="text-text-primary font-medium">{label}</span>{' '}
            <span className="font-mono text-text-muted">{shortAddress}</span>.
          </p>
        </div>

        {vaultMissing ? (
          <VaultMissingPanel onConfirm={handleResetDevice} />
        ) : (
          <form onSubmit={handleUnlock} className="space-y-3">
            <label className="block space-y-1.5">
              <span className="font-eyebrow text-text-muted text-[10px]">Password</span>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null) }}
                  autoFocus
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="w-full rounded-2xl border px-4 py-3.5 pr-10 text-sm text-text-primary outline-none placeholder:text-text-muted transition-colors"
                  style={{
                    background: 'var(--surface-2)',
                    borderColor: error ? 'var(--danger)' : 'var(--border-subtle)',
                  }}
                />
                <button type="button" onClick={() => setShow(v => !v)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && (
                <span className="flex items-center gap-1 text-danger text-[11px]">
                  <AlertTriangle className="h-3 w-3" />
                  {error}
                </span>
              )}
            </label>

            <button
              type="submit"
              disabled={busy || password.length === 0}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold transition-colors',
                busy || password.length === 0
                  ? 'text-text-muted cursor-not-allowed'
                  : 'bg-accent-primary text-accent-primary-foreground hover:bg-accent-primary-hover',
              )}
              style={busy || password.length === 0 ? { background: 'var(--surface-3)' } : {}}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {busy ? 'Unlocking…' : 'Unlock'}
            </button>

            <div className="flex items-center justify-between pt-1 text-xs">
              <button type="button" onClick={() => navigate('/import')}
                className="text-text-muted hover:text-text-primary transition-colors">
                Use recovery phrase
              </button>
              <button type="button" onClick={() => setConfirmReset(true)}
                className="text-text-muted hover:text-danger transition-colors inline-flex items-center gap-1">
                <RotateCcw className="h-3 w-3" />
                Forgot password?
              </button>
            </div>
          </form>
        )}

        {confirmReset && !vaultMissing && (
          <ResetDeviceConfirm
            onCancel={() => setConfirmReset(false)}
            onConfirm={handleResetDevice}
          />
        )}
      </div>

      <div className="relative z-10 mt-6 max-w-xs text-center">
        <p className="text-text-muted text-[10px] leading-relaxed">
          Your password is local to this device. Helio cannot reset it.
          Use your 12-word recovery phrase to restore on any device.
        </p>
      </div>
    </div>
  )
}

function VaultMissingPanel({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-2xl border p-3 text-xs"
        style={{ background: 'rgba(255,184,77,0.06)', borderColor: 'rgba(255,184,77,0.22)', color: 'var(--warning)' }}>
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span className="leading-relaxed">
          No encrypted vault was found on this device. To continue, restore your wallet using your 12-word recovery phrase.
        </span>
      </div>
      <button type="button" onClick={onConfirm}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-accent-primary py-3.5 text-sm font-semibold text-accent-primary-foreground hover:bg-accent-primary-hover transition-colors">
        Restore with recovery phrase
      </button>
    </div>
  )
}

function ResetDeviceConfirm({
  onCancel, onConfirm,
}: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}>
      <div className="w-full max-w-md rounded-3xl helio-card p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-danger/10 text-danger shrink-0">
            <RotateCcw className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-heading text-text-primary text-base font-bold">Forget this device</div>
            <p className="text-text-muted text-xs mt-1 leading-relaxed">
              Clears the local encrypted vault and label. The on-chain wallet is untouched —
              you can re-import it with your 12-word recovery phrase.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button type="button" onClick={onCancel}
            className="rounded-full border py-2.5 text-sm font-medium text-text-primary hover:bg-surface-3 transition-colors"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm}
            className="rounded-full bg-danger py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
            Forget device
          </button>
        </div>
      </div>
    </div>
  )
}
