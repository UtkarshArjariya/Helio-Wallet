import React from 'react'
import { Home, Sparkles, Activity, Settings, ArrowLeftRight, Layers } from 'lucide-react'
import { useRouter } from '../../contexts/RouterContext'
import { useWallet } from '../../contexts/WalletContext'
import { cn } from '../../lib/utils'
import { HelioWordmark } from '../ui/HelioLogo'

const PRIMARY_ITEMS = [
  { label: 'Portfolio', icon: Home,     path: '/' },
  { label: 'Vault',     icon: Sparkles, path: '/vault', badge: true },
  { label: 'Staking',   icon: Layers,   path: '/staking' },
]

const SECONDARY_ITEMS = [
  { label: 'Swap',      icon: ArrowLeftRight, path: '/swap' },
  { label: 'Activity',  icon: Activity,       path: '/activity' },
  { label: 'Settings',  icon: Settings,       path: '/settings' },
]

export function SidebarNav() {
  const { location, navigate } = useRouter()
  const { vault } = useWallet()
  const progress = Math.min(Math.round((vault.balance / vault.threshold) * 100), 100)

  const isActive = (path: string) =>
    path === '/' ? location === '/' || location === '/tokens' : location === path || location.startsWith(path + '/')

  return (
    <aside className="hidden md:flex h-full w-[240px] flex-col border-r flex-shrink-0"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}>
      <div className="px-5 py-5">
        <HelioWordmark size="md" tone="light" />
      </div>

      <nav className="flex-1 overflow-y-auto helio-scrollbar px-3 py-2 space-y-4">
        <NavGroup label="Wallet">
          {PRIMARY_ITEMS.map((item) => (
            <NavItem key={item.path} item={item} active={isActive(item.path)} onClick={() => navigate(item.path)} />
          ))}
        </NavGroup>
        <NavGroup label="Actions">
          {SECONDARY_ITEMS.map((item) => (
            <NavItem key={item.path} item={item} active={isActive(item.path)} onClick={() => navigate(item.path)} />
          ))}
        </NavGroup>
      </nav>

      {/* Vault promo */}
      <div className="p-3">
        <div className="rounded-2xl p-4 helio-orbit-bg border" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg helio-gradient-solar text-accent-primary-foreground">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="text-text-primary text-sm font-semibold">Vault</span>
          </div>
          <p className="mt-2 text-text-secondary text-xs leading-relaxed">
            {progress}% to next auto-stake. Est. 7.1% APY.
          </p>
          <button type="button" onClick={() => navigate('/vault')}
            className="mt-3 w-full rounded-full bg-accent-primary py-1.5 text-xs font-semibold text-accent-primary-foreground hover:bg-accent-primary-hover transition-colors">
            Manage
          </button>
        </div>
      </div>
    </aside>
  )
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-3 pb-1.5 text-[10px] uppercase tracking-[0.12em] text-text-muted font-semibold">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function NavItem({ item, active, onClick }: {
  item: { label: string; icon: React.ComponentType<{ className?: string }>; badge?: boolean }
  active: boolean
  onClick: () => void
}) {
  const Icon = item.icon
  return (
    <button type="button" onClick={onClick}
      className={cn('relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
        active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary')}
      style={active ? { background: 'var(--surface-3)' } : {}}>
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-accent-primary" />}
      <Icon className={cn('h-4 w-4', active ? 'text-accent-primary' : 'text-text-muted')} />
      <span className="flex-1 text-left font-medium">{item.label}</span>
      {item.badge && (
        <span className="text-[10px] font-semibold rounded-full helio-gradient-solar text-accent-primary-foreground px-1.5 py-0.5">
          NEW
        </span>
      )}
    </button>
  )
}
