import React from 'react'
import { Home, Orbit, Activity, Settings } from 'lucide-react'
import { useRouter } from '../../contexts/RouterContext'
import { cn } from '../../lib/utils'

const navItems = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'vault', label: 'Vault', icon: Orbit, path: '/vault' },
  { id: 'activity', label: 'Activity', icon: Activity, path: '/activity' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
]

export function BottomNav() {
  const { location, navigate } = useRouter()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-xl border-t border-border z-50 pb-safe">
      <div className="flex justify-around items-center h-20 px-4">
        {navItems.map((item) => {
          const isActive = location === item.path
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center w-16 h-16 gap-1 relative"
            >
              <div className={cn(
                "p-2 rounded-full transition-all duration-300",
                isActive ? "bg-accent-primary text-accent-primary-foreground shadow-glow -translate-y-2" : "text-text-secondary hover:text-text-primary"
              )}>
                <item.icon className="h-6 w-6" />
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-all duration-300 absolute bottom-1",
                isActive ? "text-accent-primary opacity-100 translate-y-0" : "text-text-muted opacity-0 translate-y-2"
              )}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
