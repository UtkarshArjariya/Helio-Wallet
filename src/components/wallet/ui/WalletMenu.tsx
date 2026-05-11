import React, { useEffect, useRef, useState } from 'react'
import {
  Check, ChevronDown, Copy, ExternalLink, LogOut, Plus, Settings, Wallet,
} from 'lucide-react'
import { useRouter } from '../../../contexts/RouterContext'
import { useWallet, lockWallet } from '../../../contexts/WalletContext'
import { cn } from '../../../lib/utils'

export function WalletPillWithMenu() {
  const { name, shortAddress, address, network } = useWallet()
  const { navigate } = useRouter()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const copy = async () => {
    if (!address) return
    try { await navigator.clipboard.writeText(address) } catch { /* ignore */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  const viewOnSolscan = () => {
    if (!address) return
    window.open(`https://solscan.io/account/${address}`, '_blank', 'noopener,noreferrer')
    setOpen(false)
  }

  const goSettings = () => { setOpen(false); navigate('/settings') }
  const goAddressBook = () => { setOpen(false); navigate('/settings/address-book') }
  const goLock = () => { setOpen(false); lockWallet(); navigate('/welcome') }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'group flex items-center gap-2 rounded-full border pl-2.5 pr-2.5 py-1.5 transition-colors',
          open ? 'bg-surface-3' : 'hover:bg-surface-3',
        )}
        style={{ background: open ? 'var(--surface-3)' : 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full',
          network.isHealthy ? 'bg-accent-primary helio-pulse-ring' : 'bg-danger')} />
        <span className="text-sm font-medium text-text-primary">{name}</span>
        <span className="font-mono text-[11px] text-text-muted">{shortAddress}</span>
        <ChevronDown className={cn('h-3 w-3 text-text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+8px)] z-50 w-[280px] overflow-hidden rounded-2xl border shadow-2xl"
          style={{
            background: 'var(--surface-1)',
            borderColor: 'var(--border-subtle)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          }}
        >
          {/* Header — wallet identity */}
          <div className="flex items-center gap-3 border-b px-4 py-3"
            style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl helio-gradient-solar text-accent-primary-foreground">
              <Wallet className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-text-primary font-medium text-sm truncate">{name}</span>
                <span className="rounded-full bg-success/10 text-success border border-success/20 text-[9px] font-semibold px-1.5 leading-none py-0.5">
                  ACTIVE
                </span>
              </div>
              <div className="font-mono text-[11px] text-text-muted truncate">{shortAddress}</div>
            </div>
          </div>

          {/* Address row + copy */}
          <button
            type="button"
            onClick={copy}
            className="group flex w-full items-center gap-2 border-b px-4 py-3 text-left transition-colors hover:bg-surface-3"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex-1 min-w-0">
              <div className="font-eyebrow text-text-muted text-[9px] mb-0.5">Address</div>
              <div className="font-mono text-[11px] text-text-secondary truncate">{address}</div>
            </div>
            {copied ? (
              <Check className="h-4 w-4 text-success shrink-0" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-text-muted shrink-0 group-hover:text-text-primary" />
            )}
          </button>

          {/* Actions */}
          <div className="p-1.5">
            <MenuItem icon={ExternalLink} label="View on Solscan" onClick={viewOnSolscan} />
            <MenuItem icon={Plus}         label="Add or import wallet" onClick={goSettings} />
            <MenuItem icon={Wallet}       label="Address book"          onClick={goAddressBook} />
            <MenuItem icon={Settings}     label="Wallet settings"       onClick={goSettings} />
          </div>

          {/* Lock — danger */}
          <div className="border-t p-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
            <MenuItem icon={LogOut} label="Lock wallet" onClick={goLock} danger />
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({
  icon: Icon, label, onClick, danger,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick?: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
        danger
          ? 'text-danger hover:bg-danger/10'
          : 'text-text-primary hover:bg-surface-3',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}
