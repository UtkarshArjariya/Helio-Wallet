import React from 'react'
import { ArrowUpRight, ArrowDownLeft, Repeat, Orbit } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'

const mockActivities = [
  { id: 1, type: 'vault_deploy', title: 'Vault Deployed', amount: '-0.10 SOL', time: 'Today, 2:30 PM', icon: Orbit, status: 'success' },
  { id: 2, type: 'swap', title: 'Swap SOL to USDC', amount: '+145.20 USDC', time: 'Yesterday, 10:15 AM', icon: Repeat, status: 'success' },
  { id: 3, type: 'vault_roundup', title: 'Vault Round-up', amount: '+0.012 SOL', time: 'Yesterday, 10:15 AM', icon: Orbit, status: 'success' },
  { id: 4, type: 'receive', title: 'Received SOL', amount: '+1.50 SOL', time: 'Apr 24, 4:00 PM', icon: ArrowDownLeft, status: 'success' },
  { id: 5, type: 'send', title: 'Sent SOL', amount: '-0.25 SOL', time: 'Apr 22, 1:45 PM', icon: ArrowUpRight, status: 'success' },
]

export function ActivityScreen() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-xl font-bold">Activity</h2>
      </div>

      <div className="space-y-3">
        {mockActivities.map((activity) => (
          <Card key={activity.id} className="bg-surface-1 border-border/50 hover:bg-surface-2 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-surface-3`}>
                  <activity.icon className="h-5 w-5 text-text-primary" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">{activity.title}</h4>
                  <p className="text-xs text-text-muted">{activity.time}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-bold text-sm ${activity.amount.startsWith('+') ? 'text-success' : 'text-text-primary'}`}>
                  {activity.amount}
                </p>
                <p className="text-xs text-success capitalize">{activity.status}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
