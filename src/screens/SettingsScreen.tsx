import React from 'react'
import { Settings, Globe, Shield, Bell, Key, LogOut, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { Switch } from '../components/ui/switch'

import { useRouter } from '../contexts/RouterContext'

const settingsGroups = [
  {
    title: "Preferences",
    items: [
      { id: "general", label: "General", icon: Settings, action: null },
      { id: "network", label: "Network", icon: Globe, value: "Mainnet", action: null },
      { id: "address-book", label: "Address Book", icon: Key, action: '/settings/address-book' },
      { id: "notifications", label: "Notifications", icon: Bell, action: null },
    ]
  },
  {
    title: "Security",
    items: [
      { id: "security", label: "Security & Privacy", icon: Shield, action: null },
      { id: "password", label: "Change Password", icon: Key, action: null },
    ]
  }
]

export function SettingsScreen() {
  const { navigate } = useRouter()
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-xl font-bold">Settings</h2>
      </div>

      <div className="space-y-6">
        {settingsGroups.map((group) => (
          <div key={group.title} className="space-y-2">
            <h3 className="text-sm font-bold text-text-muted px-2 uppercase tracking-wider">{group.title}</h3>
            <Card className="overflow-hidden border-border/50">
              <CardContent className="p-0">
                {group.items.map((item, i) => (
                  <div 
                    key={item.id}
                    className={`flex items-center justify-between p-4 cursor-pointer hover:bg-surface-3 transition-colors ${i !== group.items.length - 1 ? 'border-b border-border/50' : ''}`}
                    onClick={() => item.action && navigate(item.action)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-text-muted"><item.icon className="h-5 w-5" /></div>
                      <span className="font-medium text-sm">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.value && <span className="text-sm text-text-muted">{item.value}</span>}
                      <ChevronRight className="h-4 w-4 text-text-muted" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ))}

        <div className="pt-4">
          <Card className="border-danger/20 bg-danger/5 hover:bg-danger/10 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-4 text-danger">
              <LogOut className="h-5 w-5" />
              <span className="font-bold text-sm">Lock Wallet</span>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
