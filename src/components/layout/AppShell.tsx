import React, { useState, useRef, useEffect } from 'react'
import { SidebarNav } from './SidebarNav'
import { BottomNav } from './BottomNav'
import { WalletProvider, useWallet } from '../../contexts/WalletContext'
import { RouterProvider, useRouter } from '../../contexts/RouterContext'
import { Bell, ChevronDown, Menu, X, Sparkles, TrendingUp, AlertCircle } from 'lucide-react'
import { HelioWordmark } from '../ui/HelioLogo'
import { cn } from '../../lib/utils'

interface Notification {
  id: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  iconColor: string
  iconBg: string
  title: string
  body: string
  time: string
  read: boolean
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    icon: Sparkles,
    iconColor: 'var(--accent-primary)',
    iconBg: 'rgba(198,240,0,0.12)',
    title: 'Vault threshold reached',
    body: '0.10 SOL accumulated — auto-staking to Helio Validator.',
    time: '2 min ago',
    read: false,
  },
  {
    id: 'n2',
    icon: TrendingUp,
    iconColor: '#4ade80',
    iconBg: 'rgba(74,222,128,0.1)',
    title: 'Staking reward received',
    body: '+0.004 SOL from Helio Validator.',
    time: '1 hr ago',
    read: false,
  },
  {
    id: 'n3',
    icon: AlertCircle,
    iconColor: '#ffb84d',
    iconBg: 'rgba(255,184,77,0.1)',
    title: 'Price alert — SOL',
    body: 'SOL is up 5.2% in the last 24 h.',
    time: '3 hr ago',
    read: true,
  },
]

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  const dismiss = (id: string) => setNotifications((prev) => prev.filter((n) => n.id !== id))
  const unread = notifications.filter((n) => !n.read).length

  return (
    <div
      ref={panelRef}
      className="absolute right-3 top-[calc(100%+8px)] z-50 w-[320px] rounded-2xl border shadow-2xl overflow-hidden"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <span className="text-text-primary font-semibold text-sm">Notifications</span>
          {unread > 0 && (
            <span className="rounded-full bg-accent-primary text-accent-primary-foreground text-[10px] font-bold px-1.5 py-0.5 leading-none">
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button type="button" onClick={markAllRead}
              className="text-[11px] text-text-muted hover:text-accent-primary transition-colors">
              Mark all read
            </button>
          )}
          <button type="button" onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-surface-3 text-text-muted hover:text-text-primary transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[340px] overflow-y-auto helio-scrollbar">
        {notifications.length === 0 ? (
          <div className="py-10 text-center text-text-muted text-sm">No notifications</div>
        ) : (
          notifications.map((n) => {
            const Icon = n.icon
            return (
              <div key={n.id}
                className={cn('flex items-start gap-3 px-4 py-3.5 border-b last:border-0 transition-colors',
                  !n.read && 'bg-white/[0.025]')}
                style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl mt-0.5"
                  style={{ background: n.iconBg }}>
                  <Icon className="h-4 w-4" style={{ color: n.iconColor }} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-primary text-xs font-semibold">{n.title}</span>
                    {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-accent-primary shrink-0" />}
                  </div>
                  <p className="text-text-muted text-xs mt-0.5 leading-relaxed">{n.body}</p>
                  <span className="text-text-muted text-[10px] mt-1 block">{n.time}</span>
                </div>
                <button type="button" onClick={() => dismiss(n.id)}
                  className="text-text-muted hover:text-text-primary transition-colors mt-0.5 shrink-0">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function PopupTopHeader() {
  const { navigate } = useRouter()
  const [showNotifications, setShowNotifications] = useState(false)
  const [hasUnread, setHasUnread] = useState(true)

  const handleBellClick = () => {
    setShowNotifications((v) => !v)
    if (!showNotifications) setHasUnread(false)
  }

  return (
    <header className="relative sticky top-0 z-30 flex items-center justify-between gap-2 px-4 py-3 border-b backdrop-blur-md"
      style={{ background: 'rgba(0,0,0,0.82)', borderColor: 'var(--border-subtle)' }}>
      <HelioWordmark size="sm" tone="light" />

      <div className="flex items-center gap-1">
        <button type="button" aria-label="Notifications" onClick={handleBellClick}
          className={cn('relative flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:text-text-primary transition-colors',
            showNotifications && 'text-text-primary')}
          style={{ background: showNotifications ? 'var(--surface-3)' : 'var(--surface-2)' }}>
          <Bell className="h-4 w-4" />
          {hasUnread && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent-primary" />
          )}
        </button>

        <button type="button" aria-label="Menu" onClick={() => navigate('/settings')}
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:text-text-primary transition-colors"
          style={{ background: 'var(--surface-2)' }}>
          <Menu className="h-4 w-4" />
        </button>
      </div>

      {showNotifications && (
        <NotificationPanel onClose={() => setShowNotifications(false)} />
      )}
    </header>
  )
}

function DesktopTopHeader() {
  const { navigate } = useRouter()
  const { name, shortAddress, network } = useWallet()
  const [showNotifications, setShowNotifications] = useState(false)
  const [hasUnread, setHasUnread] = useState(true)

  const handleBellClick = () => {
    setShowNotifications((v) => !v)
    if (!showNotifications) setHasUnread(false)
  }

  return (
    <header className="relative flex items-center justify-between gap-4 px-6 py-4 border-b"
      style={{ background: 'rgba(0,0,0,0.6)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Switch wallet"
          className="flex items-center gap-2 rounded-full px-3 py-2 text-sm border hover:bg-surface-3 transition-colors"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
          <span className={cn('h-2 w-2 rounded-full', network.isHealthy ? 'bg-success' : 'bg-danger')} />
          <span className="font-medium text-text-primary text-xs">{name}</span>
          <span className="font-mono text-text-muted text-xs">{shortAddress}</span>
          <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" aria-label="Notifications" onClick={handleBellClick}
          className={cn('relative flex h-9 w-9 items-center justify-center rounded-full border text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-colors',
            showNotifications && 'text-text-primary bg-surface-3')}
          style={{ background: showNotifications ? 'var(--surface-3)' : 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
          <Bell className="h-4 w-4" />
          {hasUnread && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent-primary" style={{ outline: '2px solid var(--bg)' }} />
          )}
        </button>

        <button type="button" onClick={() => navigate('/settings')}
          className="rounded-full helio-gradient-solar px-4 py-2 text-sm font-semibold text-accent-primary-foreground hover:opacity-90 transition-opacity">
          Settings
        </button>
      </div>

      {showNotifications && (
        <NotificationPanel onClose={() => setShowNotifications(false)} />
      )}
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
