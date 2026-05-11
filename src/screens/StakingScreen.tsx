import React from 'react'
import { Layers, Sparkles } from 'lucide-react'
import { ScreenHeader } from '../components/wallet/ui/ScreenHeader'
import { EmptyState } from '../components/wallet/ui/EmptyState'

export function StakingScreen() {
  return (
    <div className="flex flex-col">
      <ScreenHeader title="Stake SOL" subtitle="Earn rewards each epoch" />

      <div className="relative p-4" style={{ isolation: 'isolate' }}>
        {/* Royal-blue glow — yield surface */}
        <div
          className="pointer-events-none absolute -left-12 top-20 h-60 w-60 rounded-full"
          style={{ background: 'rgba(26,31,184,0.16)', filter: 'blur(80px)', zIndex: -1 }}
        />

        <EmptyState
          eyebrow="Coming soon"
          figure="00.00"
          figureUnit="% APY"
          headline="Native staking is on the way."
          body={
            <>
              We're integrating native validator delegation and liquid staking so you can earn epoch rewards directly from this wallet. Until then, your Vault round-ups still accumulate — switch over from the bottom nav.
            </>
          }
          primary={{
            label: 'Open Vault',
            icon: Layers,
            href: '/vault',
          }}
          secondary={{
            label: 'Notify me',
            icon: Sparkles,
          }}
        />
      </div>
    </div>
  )
}
