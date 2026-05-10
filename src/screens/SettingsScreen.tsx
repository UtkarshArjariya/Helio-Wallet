import React from 'react'
import { Globe, Shield, Bell, Key, LogOut, ChevronRight, User, Lock } from 'lucide-react'
import { useRouter } from '../contexts/RouterContext'
import { lockWallet } from '../contexts/WalletContext'
import { cn } from '../lib/utils'

interface SettingsItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  value?: string
  path?: string
}

const SETTINGS_GROUPS: { label: string; items: SettingsItem[] }[] = [
  {
    label: 'General',
    items: [
      { id: 'network',       label: 'Network',        icon: Globe,  value: 'Mainnet' },
      { id: 'notifications', label: 'Notifications',  icon: Bell },
      { id: 'address-book',  label: 'Address Book',   icon: User,   path: '/settings/address-book' },
    ],
  },
  {
    label: 'Security',
    items: [
      { id: 'security',  label: 'Security & Privacy', icon: Shield },
      { id: 'password',  label: 'Change Password',    icon: Key },
      { id: 'auto-lock', label: 'Auto-lock',          icon: Lock, value: '5 min' },
    ],
  },
]

export function SettingsScreen() {
  const { navigate } = useRouter()

  const handleLock = () => {
    lockWallet()
    navigate('/welcome')
  }

  return (
    <div className="flex flex-col">
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="text-text-primary font-heading font-semibold">Settings</div>
      </div>

      <div className="p-4 space-y-4">
        {SETTINGS_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-1 pb-2 text-[10px] uppercase tracking-[0.12em] text-text-muted font-semibold">
              {group.label}
            </p>
            <div className="rounded-2xl helio-card overflow-hidden">
              {group.items.map((item, i) => {
                const Icon = item.icon
                const isLast = i === group.items.length - 1
                return (
                  <button key={item.id} type="button"
                    onClick={() => item.path ? navigate(item.path) : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors',
                      item.path ? 'hover:bg-surface-3 cursor-pointer' : 'cursor-default',
                      !isLast && 'border-b',
                    )}
                    style={!isLast ? { borderColor: 'var(--border-subtle)' } : {}}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl text-text-muted shrink-0"
                      style={{ background: 'var(--surface-3)' }}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-sm font-medium text-text-primary">{item.label}</span>
                    <div className="flex items-center gap-2">
                      {item.value && <span className="text-xs text-text-muted">{item.value}</span>}
                      {item.path && <ChevronRight className="h-4 w-4 text-text-muted" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <button type="button" onClick={handleLock}
          className="flex w-full items-center gap-3 rounded-2xl border p-4 text-danger hover:opacity-80 transition-opacity"
          style={{ background: 'rgba(255,59,63,0.06)', borderColor: 'rgba(255,59,63,0.18)' }}>
          <LogOut className="h-4 w-4" />
          <span className="font-semibold text-sm">Lock Wallet</span>
        </button>

        <p className="text-center text-[10px] text-text-muted pb-2">Helio Wallet v0.1.0 · Solana Mainnet</p>
      </div>
    </div>
  )
}
