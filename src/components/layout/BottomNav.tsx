import React from 'react'
import { Home, Sparkles, Activity, Settings } from 'lucide-react'
import { useRouter } from '../../contexts/RouterContext'
import { cn } from '../../lib/utils'

const NAV_ITEMS = [
  { id: 'home',     label: 'Home',     icon: Home,     path: '/' },
  { id: 'vault',    label: 'Vault',    icon: Sparkles, path: '/vault',    highlight: true },
  { id: 'activity', label: 'Activity', icon: Activity, path: '/activity' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
] as const

export function BottomNav() {
  const { location, navigate } = useRouter()

  const isActive = (path: string) =>
    path === '/' ? location === '/' || location === '/tokens' : location === path || location.startsWith(path + '/')

  return (
    <nav
      className="sticky bottom-0 z-30 grid grid-cols-4 gap-0.5 border-t backdrop-blur-md px-1 pt-1.5 pb-3"
      style={{ background: 'rgba(12,12,12,0.92)', borderColor: 'var(--border-subtle)' }}
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const active = isActive(item.path)
        const highlight = 'highlight' in item && item.highlight
        return (
          <button
            type="button"
            key={item.id}
            onClick={() => navigate(item.path)}
            className={cn(
              'relative flex flex-col items-center justify-center gap-0.5 rounded-2xl py-2 transition-colors',
              active ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary',
            )}
          >
            {active && (
              <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-accent-primary" />
            )}
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-xl transition-colors',
                highlight
                  ? active ? 'helio-gradient-solar text-accent-primary-foreground' : 'text-accent-primary'
                  : active ? 'text-text-primary' : '',
              )}
              style={
                highlight && !active ? { background: 'rgba(198,240,0,0.1)' }
                : active && !highlight ? { background: 'var(--surface-3)' }
                : {}
              }
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="text-[9px] font-medium">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
