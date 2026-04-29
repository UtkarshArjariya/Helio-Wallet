import React from 'react'
import { Home, Layers, Orbit, Activity, Settings, Zap } from 'lucide-react'
import { useRouter } from '../../contexts/RouterContext'
import { cn } from '../../lib/utils'

const navItems = [
  { id: 'home', label: 'Portfolio', icon: Home, path: '/' },
  { id: 'tokens', label: 'Tokens', icon: Layers, path: '/tokens' },
  { id: 'vault', label: 'Helio Vault', icon: Orbit, path: '/vault' },
  { id: 'staking', label: 'Staking', icon: Zap, path: '/staking' },
  { id: 'activity', label: 'Activity', icon: Activity, path: '/activity' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
]

export function SidebarNav() {
  const { location, navigate } = useRouter()

  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-border bg-surface-1">
      <div className="p-6">
        <h2 className="font-heading text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
          <Orbit className="h-6 w-6 text-accent-primary" />
          Helio Wallet
        </h2>
      </div>
      
      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => {
          const isActive = location === item.path
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium",
                isActive 
                  ? "bg-accent-primary/10 text-accent-primary" 
                  : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
              {item.id === 'vault' && (
                <span className="ml-auto flex h-2 w-2 rounded-full bg-accent-primary shadow-glow"></span>
              )}
            </button>
          )
        })}
      </nav>
      
      <div className="p-6">
        <div className="rounded-xl bg-gradient-solar p-4 text-accent-primary-foreground shadow-glow">
          <p className="font-heading font-bold text-sm mb-1">Upgrade to Pro</p>
          <p className="text-xs opacity-80 mb-3">Get advanced analytics and custom RPCs.</p>
          <button className="text-xs font-bold bg-background text-text-primary px-3 py-1.5 rounded-lg w-full hover:bg-surface-2 transition-colors">
            Learn More
          </button>
        </div>
      </div>
    </aside>
  )
}
