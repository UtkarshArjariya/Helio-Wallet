import React from 'react'
import { ArrowRight, KeyRound, Plus } from 'lucide-react'
import { useRouter } from '../contexts/RouterContext'
import { HelioWordmark, HelioMark } from '../components/ui/HelioLogo'
import { generateAndSaveWallet } from '../contexts/WalletContext'

export function OnboardingScreen() {
  const { navigate } = useRouter()

  const createWallet = () => {
    generateAndSaveWallet('Main Wallet')
    navigate('/')
  }

  return (
    <div className="relative flex min-h-full flex-col items-center justify-between overflow-hidden p-6 helio-orbit-bg" style={{ minHeight: '100vh' }}>
      <div className="relative z-10 w-full pt-4 flex justify-center">
        <HelioWordmark size="md" tone="light" />
      </div>

      <div className="relative z-10 my-8 max-w-sm text-center">
        <div className="relative mx-auto mb-6 flex h-28 w-28 items-center justify-center">
          <div className="helio-pulse-ring absolute inset-0 rounded-full opacity-40 blur-2xl"
            style={{ background: 'var(--accent-primary)' }} />
          <div className="helio-float relative rounded-3xl overflow-hidden"
            style={{ boxShadow: '0 24px 60px -20px rgba(198,240,0,0.45)' }}>
            <HelioMark size={112} />
          </div>
        </div>
        <h1 className="text-3xl font-heading font-semibold text-text-primary" style={{ letterSpacing: '-0.02em' }}>
          Your wallet.<br /><span className="helio-text-gradient">In orbit.</span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary max-w-xs mx-auto">
          A non-custodial Solana wallet that turns spare change into yield. Round up. Auto-deploy. Compound.
        </p>
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-2.5 pb-8">
        <button type="button" onClick={createWallet}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-accent-primary py-3.5 text-sm font-semibold text-accent-primary-foreground hover:bg-accent-primary-hover transition-colors">
          <Plus className="h-4 w-4" />Create new wallet<ArrowRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => navigate('/import')}
          className="flex w-full items-center justify-center gap-2 rounded-full border py-3.5 text-sm font-medium text-text-primary hover:bg-surface-3 transition-colors"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
          <KeyRound className="h-4 w-4" />I already have a wallet
        </button>
        <p className="text-center text-[10px] text-text-muted">
          By continuing, you agree to the{' '}
          <span className="text-text-secondary underline cursor-pointer">Terms</span> and{' '}
          <span className="text-text-secondary underline cursor-pointer">Privacy Policy</span>.
        </p>
      </div>
    </div>
  )
}
