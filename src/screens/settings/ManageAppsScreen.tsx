import React from 'react'
import { ShieldCheck } from 'lucide-react'
import { ScreenHeader } from '../../components/wallet/ui/ScreenHeader'
import { EmptyState } from '../../components/wallet/ui/EmptyState'

export function ManageAppsScreen() {
  return (
    <div className="flex flex-col">
      <ScreenHeader title="Manage apps" subtitle="dApps connected to this wallet" />

      <div className="p-4 space-y-4">
        <EmptyState
          eyebrow="No dApps connected"
          figure="00"
          headline="Nothing has access yet."
          body="When you connect Helio to a Solana app — Jupiter, Drift, Kamino, etc. — it will show up here with a per-app revoke button."
          primary={{ label: 'Open Jupiter ↗', href: 'https://jup.ag', external: true }}
          secondary={{ label: 'Open Kamino ↗', href: 'https://kamino.finance', external: true }}
        />

        <p className="text-text-muted text-[11px] px-1 leading-relaxed inline-flex items-start gap-1.5">
          <ShieldCheck className="h-3 w-3 text-accent-primary mt-0.5 shrink-0" />
          <span>
            Every connection requires an explicit signature. Helio never auto-approves transactions.
          </span>
        </p>
      </div>
    </div>
  )
}
