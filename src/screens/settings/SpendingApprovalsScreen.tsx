import React from 'react'
import { ShieldCheck } from 'lucide-react'
import { ScreenHeader } from '../../components/wallet/ui/ScreenHeader'
import { EmptyState } from '../../components/wallet/ui/EmptyState'

export function SpendingApprovalsScreen() {
  return (
    <div className="flex flex-col">
      <ScreenHeader title="Spending approvals" subtitle="Token allowances granted to programs" />

      <div className="p-4 space-y-4">
        <EmptyState
          eyebrow="No standing approvals"
          figure="00"
          headline="Nothing approved for spending."
          body="When a program asks for permission to spend a specific token on your behalf — common on lending, perp, and DEX protocols — the active grants appear here with a one-tap revoke."
        />

        <p className="text-text-muted text-[11px] px-1 leading-relaxed inline-flex items-start gap-1.5">
          <ShieldCheck className="h-3 w-3 text-accent-primary mt-0.5 shrink-0" />
          <span>
            Helio uses Solana's native delegate accounts. Revoking removes the program's ability to move that token without your re-approval.
          </span>
        </p>
      </div>
    </div>
  )
}
