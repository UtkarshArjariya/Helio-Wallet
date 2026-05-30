import React, { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  AlertTriangle, Building2, Check, Copy, CreditCard, QrCode, Share2,
} from 'lucide-react'
import { useWallet } from '../contexts/WalletContext'
import { ACTIVE_CLUSTER_LABEL } from '../lib/rpc-service'
import { ScreenHeader } from '../components/wallet/ui/ScreenHeader'

export function ReceiveScreen() {
  return (
    <div className="flex flex-col">
      <ScreenHeader title="Deposit" subtitle="Add funds to your wallet" />

      <div className="relative p-4 space-y-3" style={{ isolation: 'isolate' }}>
        {/* Lime glow — incoming flow */}
        <div className="pointer-events-none absolute -right-10 top-10 h-60 w-60 rounded-full"
          style={{ background: 'rgba(198,240,0,0.10)', filter: 'blur(80px)', zIndex: -1 }} />

        <DepositOption
          icon={<CreditCard className="h-4 w-4" />}
          title="Buy with card or bank"
          subtitle="Onramp via partner · KYC required"
        />
        <DepositOption
          icon={<Building2 className="h-4 w-4" />}
          title="Transfer from exchange"
          subtitle="Coinbase, Binance, Kraken, …"
        />
        <DepositOption
          icon={<QrCode className="h-4 w-4" />}
          title="Receive crypto"
          subtitle="From another Solana wallet"
          highlight
        />
      </div>

      <div className="px-4 pb-4">
        <ReceiveCard />
      </div>
    </div>
  )
}

function DepositOption({
  icon, title, subtitle, highlight,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  highlight?: boolean
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-2xl helio-card p-4 hover:bg-surface-3 transition-colors text-left"
    >
      <span
        className={
          highlight
            ? 'flex h-10 w-10 items-center justify-center rounded-2xl helio-gradient-solar text-accent-primary-foreground'
            : 'flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-3 text-text-secondary'
        }
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-text-primary text-sm font-semibold">{title}</div>
        <div className="text-text-muted text-xs">{subtitle}</div>
      </div>
    </button>
  )
}

function ReceiveCard() {
  const { fullAddress, name } = useWallet()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullAddress)
    } catch { /* ignore */ }
    setCopied(true)
  }

  const handleShare = async () => {
    // Native share sheet where supported (mobile / some desktops); otherwise
    // fall back to copying the address so the button always does something.
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `${name} · Solana address`, text: fullAddress })
        return
      } catch { /* user cancelled or unsupported — fall through to copy */ }
    }
    await handleCopy()
  }

  return (
    <div className="rounded-3xl helio-card p-5">
      <div className="font-eyebrow text-text-muted text-[10px] mb-3">Receive crypto</div>

      <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-3xl border bg-white p-3"
        style={{ borderColor: 'var(--border-subtle)' }}>
        {fullAddress ? (
          <QRCodeSVG
            value={fullAddress}
            size={152}
            level="M"
            marginSize={0}
            bgColor="#FFFFFF"
            fgColor="#000000"
            aria-label="Wallet address QR code"
          />
        ) : (
          <div className="h-full w-full animate-pulse rounded-xl bg-black/10" />
        )}
      </div>

      <div className="mt-4 text-center">
        <div className="text-text-primary text-base font-heading font-semibold">{name}</div>
        <div className="text-text-muted text-xs font-mono mt-0.5">Solana · {ACTIVE_CLUSTER_LABEL}</div>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="mt-3 flex w-full items-center gap-2 rounded-2xl border px-3 py-3 text-left transition-colors hover:bg-surface-3"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
      >
        <span className="flex-1 truncate text-text-primary font-mono text-xs">{fullAddress}</span>
        {copied ? (
          <Check className="h-4 w-4 text-success shrink-0" />
        ) : (
          <Copy className="h-4 w-4 text-text-muted shrink-0" />
        )}
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-full border py-2.5 text-sm font-medium text-text-primary hover:bg-surface-3 transition-colors"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
        >
          {copied ? 'Copied' : 'Copy address'}
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-accent-primary py-2.5 text-sm font-semibold text-accent-primary-foreground hover:bg-accent-primary-hover transition-colors"
        >
          <Share2 className="h-3.5 w-3.5" />
          Share
        </button>
      </div>

      <div
        className="mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs"
        style={{
          background: 'rgba(255,184,77,0.06)',
          borderColor: 'rgba(255,184,77,0.2)',
          color: 'var(--warning)',
        }}
      >
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Only send Solana network assets to this address. Sending tokens from
          a different network may result in permanent loss.
        </span>
      </div>
    </div>
  )
}

