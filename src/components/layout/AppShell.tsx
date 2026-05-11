import React, { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { SidebarNav } from './SidebarNav'
import { BottomNav } from './BottomNav'
import { WalletProvider, useWallet } from '../../contexts/WalletContext'
import { RouterProvider, useRouter } from '../../contexts/RouterContext'
import { Bell, ChevronDown, Menu, X, Sparkles, TrendingUp, AlertCircle, Globe2, BellOff } from 'lucide-react'
import { HelioWordmark } from '../ui/HelioLogo'
import { LiveStatusBar } from '../wallet/ui/LiveStatusBar'
import { cn } from '../../lib/utils'

interface Notification {
  id: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  iconColor: string
  iconBg: string
  title: string
  body: string
  date: string   // ISO
  read: boolean
}

/** Hour offsets used to build mock timestamps — keep notifications near "now". */
const HOUR = 60 * 60 * 1000
function isoAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString()
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    icon: Sparkles,
    iconColor: 'var(--accent-primary)',
    iconBg: 'rgba(198,240,0,0.12)',
    title: 'Vault threshold reached',
    body: '0.10 SOL accumulated — auto-staking to Helio Validator.',
    date: isoAgo(2 * 60 * 1000),
    read: false,
  },
  {
    id: 'n2',
    icon: TrendingUp,
    iconColor: '#4ade80',
    iconBg: 'rgba(74,222,128,0.1)',
    title: 'Staking reward received',
    body: '+0.004 SOL from Helio Validator.',
    date: isoAgo(HOUR),
    read: false,
  },
  {
    id: 'n3',
    icon: AlertCircle,
    iconColor: '#ffb84d',
    iconBg: 'rgba(255,184,77,0.1)',
    title: 'Price alert — SOL',
    body: 'SOL is up 5.2% in the last 24 h.',
    date: isoAgo(28 * HOUR),
    read: true,
  },
]

/** Bucket label and ordering for a notification's age. */
function bucket(iso: string): { key: 'today' | 'yesterday' | 'earlier'; label: string; order: number } {
  const d   = new Date(iso)
  const now = new Date()
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  if (isSameDay(d, now))                                     return { key: 'today',     label: 'Today',     order: 0 }
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (isSameDay(d, yesterday))                               return { key: 'yesterday', label: 'Yesterday', order: 1 }
  return { key: 'earlier', label: 'Earlier', order: 2 }
}

/** Relative time pretty-print. e.g. "2 min", "3 hr", "Apr 18". */
function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m  = Math.round(ms / 60000)
  if (m < 1)         return 'now'
  if (m < 60)        return `${m} min`
  const h = Math.round(m / 60)
  if (h < 24)        return `${h} hr`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS)
  const panelRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  // Close on outside-click and Escape
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  const dismiss     = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id))
  const unread      = notifications.filter(n => !n.read).length

  // Group notifications by day bucket — Today / Yesterday / Earlier
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; order: number; items: Notification[] }>()
    for (const n of notifications) {
      const b = bucket(n.date)
      const entry = map.get(b.key) ?? { label: b.label, order: b.order, items: [] }
      entry.items.push(n)
      map.set(b.key, entry)
    }
    // Sort buckets by recency, items inside each bucket by recency
    return Array.from(map.values())
      .sort((a, b) => a.order - b.order)
      .map(g => ({ ...g, items: [...g.items].sort((a, b) => +new Date(b.date) - +new Date(a.date)) }))
  }, [notifications])

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: reduce ? 0 : -6, scale: reduce ? 1 : 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      role="dialog"
      aria-label="Notifications"
      className="absolute right-3 top-[calc(100%+8px)] z-50 w-[340px] rounded-2xl border overflow-hidden"
      style={{
        background: 'var(--surface-1)',
        borderColor: 'var(--border-subtle)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <span className="font-heading text-text-primary font-semibold text-sm">Notifications</span>
          {unread > 0 && (
            <span className="font-mono rounded-full bg-accent-primary text-accent-primary-foreground text-[10px] font-bold px-1.5 py-0.5 leading-none tabular-nums">
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
          <button type="button" onClick={onClose} aria-label="Close"
            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-surface-3 text-text-muted hover:text-text-primary transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-h-[400px] overflow-y-auto helio-scrollbar">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-10 text-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: 'var(--surface-2)' }}>
              <BellOff className="h-4 w-4 text-text-muted" />
            </span>
            <div className="font-figure text-text-primary/30 text-3xl font-extrabold tabular-nums select-none leading-none">—</div>
            <div className="text-text-primary text-sm font-medium">All clear.</div>
            <div className="text-text-muted text-xs max-w-[22ch]">
              Vault thresholds, rewards and price alerts will land here.
            </div>
          </div>
        ) : (
          grouped.map((group, gi) => (
            <div key={group.label}>
              <div
                className={cn(
                  'flex items-center gap-2 px-4 pt-3 pb-1.5',
                  gi > 0 && 'border-t',
                )}
                style={gi > 0 ? { borderColor: 'var(--border-subtle)' } : {}}
              >
                <span className="h-px flex-1" style={{ background: 'var(--border-subtle)' }} />
                <span className="font-eyebrow text-text-muted text-[9px]">{group.label}</span>
                <span className="h-px flex-1" style={{ background: 'var(--border-subtle)' }} />
              </div>

              <AnimatePresence initial={false}>
                {group.items.map((n) => {
                  const Icon = n.icon
                  return (
                    <motion.div
                      key={n.id}
                      layout
                      initial={{ opacity: 0, x: reduce ? 0 : -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 16, height: 0, marginTop: 0, marginBottom: 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        'group relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60',
                        !n.read && 'bg-accent-primary/[0.04]',
                      )}
                    >
                      {/* Unread accent stripe — full-height down the left edge */}
                      {!n.read && (
                        <span
                          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
                          style={{ background: 'var(--accent-primary)' }}
                        />
                      )}

                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl mt-0.5"
                        style={{ background: n.iconBg }}>
                        <Icon className="h-4 w-4" style={{ color: n.iconColor }} />
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={cn(
                            'text-xs font-semibold truncate',
                            n.read ? 'text-text-secondary' : 'text-text-primary',
                          )}>
                            {n.title}
                          </span>
                          <span className="font-mono text-text-muted text-[10px] shrink-0">
                            {relTime(n.date)}
                          </span>
                        </div>
                        <p className="text-text-muted text-xs mt-0.5 leading-relaxed">{n.body}</p>
                      </div>

                      <button type="button" onClick={() => dismiss(n.id)}
                        aria-label="Dismiss"
                        className="text-text-muted hover:text-text-primary transition-opacity mt-1 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100">
                        <X className="h-3 w-3" />
                      </button>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </motion.div>
  )
}

function PopupTopHeader() {
  const { navigate } = useRouter()
  const { loading, network } = useWallet()
  const [showNotifications, setShowNotifications] = useState(false)
  const [hasUnread, setHasUnread] = useState(true)

  const handleBellClick = () => {
    setShowNotifications(v => !v)
    if (!showNotifications) setHasUnread(false)
  }

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md"
      style={{ background: 'rgba(0,0,0,0.82)' }}>
      {/* 1.5 px live status hairline — pulses lime when idle, travels when fetching */}
      <LiveStatusBar loading={loading} healthy={network.isHealthy} />

      <div className="relative flex items-center justify-between gap-2 px-4 py-3 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}>
        <HelioWordmark size="sm" tone="light" />

        <div className="flex items-center gap-1">
          <button type="button" aria-label="Networks"
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:text-text-primary transition-colors"
            style={{ background: 'var(--surface-2)' }}>
            <Globe2 className="h-4 w-4" />
          </button>

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

        <AnimatePresence>
          {showNotifications && (
            <NotificationPanel onClose={() => setShowNotifications(false)} />
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}

function DesktopTopHeader() {
  const { navigate } = useRouter()
  const { name, shortAddress, network, loading } = useWallet()
  const [showNotifications, setShowNotifications] = useState(false)
  const [hasUnread, setHasUnread] = useState(true)

  const handleBellClick = () => {
    setShowNotifications(v => !v)
    if (!showNotifications) setHasUnread(false)
  }

  return (
    <header style={{ background: 'rgba(0,0,0,0.6)' }}>
      {/* 1.5 px live status hairline */}
      <LiveStatusBar loading={loading} healthy={network.isHealthy} />

      <div className="relative flex items-center justify-between gap-4 px-6 py-4 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}>
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

        <AnimatePresence>
          {showNotifications && (
            <NotificationPanel onClose={() => setShowNotifications(false)} />
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}

/** Routes that should render without the wallet chrome (sidebar / bottom nav /
 * top header). These are pre-authentication / onboarding states. */
const CHROMELESS_ROUTES = new Set([
  '/welcome', '/import', '/create-password', '/seed-phrase', '/unlock',
])

function ShellInner({ children }: { children: React.ReactNode }) {
  const { location } = useRouter()
  const chromeless = CHROMELESS_ROUTES.has(location)

  if (chromeless) {
    return (
      <div className="helio-bg-atmosphere flex h-screen w-full flex-col overflow-hidden"
        style={{ minWidth: 360, minHeight: 600 }}>
        <main className="relative z-10 flex-1 overflow-y-auto helio-scrollbar">
          {children}
        </main>
      </div>
    )
  }

  return (
    <>
      {/* Desktop */}
      <div className="helio-bg-atmosphere hidden md:flex h-screen w-full overflow-hidden">
        <SidebarNav />
        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <DesktopTopHeader />
          <main className="flex-1 overflow-y-auto helio-scrollbar">{children}</main>
        </div>
      </div>

      {/* Popup / mobile */}
      <div className="helio-bg-atmosphere md:hidden flex h-screen w-full flex-col"
        style={{ minWidth: 360, minHeight: 600 }}>
        <div className="relative z-10 flex flex-1 min-h-0 flex-col">
          <PopupTopHeader />
          <main className="flex-1 overflow-y-auto helio-scrollbar overscroll-contain">{children}</main>
          <BottomNav />
        </div>
      </div>
    </>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <RouterProvider>
      <WalletProvider>
        <ShellInner>{children}</ShellInner>
      </WalletProvider>
    </RouterProvider>
  )
}
