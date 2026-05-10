import React from 'react'
import { SidebarNav } from './SidebarNav'
import { BottomNav } from './BottomNav'
import { WalletProvider } from '../../contexts/WalletContext'
import { RouterProvider, useRouter } from '../../contexts/RouterContext'
import { Bell, Globe2, ChevronDown, Menu } from 'lucide-react'
import { useWallet } from '../../contexts/WalletContext'
import { HelioWordmark } from '../ui/HelioLogo'

function PopupTopHeader() {
  const { navigate } = useRouter()
  const { name, address } = useWallet()
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-2 px-4 py-3 border-b backdrop-blur-md"
      style={{ background: 'rgba(0,0,0,0.82)', borderColor: 'var(--border-subtle)' }}
    >
      <HelioWordmark size="sm" tone="light" />
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Networks"
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:text-text-primary transition-colors"
          style={{ background: 'var(--surface-2)' }}>
          <Globe2 className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Notifications"
          className="relative flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:text-text-primary transition-colors"
          style={{ background: 'var(--surface-2)' }}>
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent-primary" />
        </button>
        <button type="button" onClick={() => navigate('/settings')} aria-label="Menu"
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:text-text-primary transition-colors"
          style={{ background: 'var(--surface-2)' }}>
          <Menu className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}

function DesktopTopHeader() {
  const { navigate } = useRouter()
  const { name, address } = useWallet()
  return (
    <header
      className="flex items-center justify-between gap-4 px-6 py-4 border-b"
      style={{ background: 'rgba(0,0,0,0.6)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-center gap-3">
        <button type="button"
          className="flex items-center gap-2 rounded-full px-3 py-2 text-sm border hover:bg-surface-3 transition-colors"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="font-medium text-text-primary">{name}</span>
          <span className="font-mono text-text-muted text-xs">{address}</span>
          <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button type="button"
          className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm border text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-colors"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
          <Globe2 className="h-4 w-4" />Mainnet<ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button type="button" aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-full border text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-colors"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent-primary" style={{ outline: '2px solid var(--bg)' }} />
        </button>
        <button type="button" onClick={() => navigate('/settings')}
          className="rounded-full helio-gradient-solar px-4 py-2 text-sm font-semibold text-accent-primary-foreground hover:opacity-90 transition-opacity">
          Connect
        </button>
      </div>
    </header>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <RouterProvider>
      <WalletProvider>
        {/* Desktop */}
        <div className="hidden md:flex h-screen w-full overflow-hidden" style={{ background: 'var(--bg)' }}>
          <SidebarNav />
          <div className="flex min-w-0 flex-1 flex-col">
            <DesktopTopHeader />
            <main className="flex-1 overflow-y-auto helio-scrollbar">{children}</main>
          </div>
        </div>

        {/* Popup / mobile */}
        <div className="md:hidden flex h-screen w-full flex-col" style={{ background: 'var(--bg)', minWidth: 360, minHeight: 600 }}>
          <PopupTopHeader />
          <main className="flex-1 overflow-y-auto helio-scrollbar overscroll-contain">{children}</main>
          <BottomNav />
        </div>
      </WalletProvider>
    </RouterProvider>
  )
}
