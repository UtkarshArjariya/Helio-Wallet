import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Switch } from '../ui/switch'
import { useWallet } from '../../contexts/WalletContext'

export function VaultRules() {
  const { vault, updateVaultRule } = useWallet()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto-Save Rules</CardTitle>
        <CardDescription>Configure how spare change is accumulated.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RuleRow
          title="Round up transfers"
          description="Round up outgoing SOL transfers to the nearest integer."
          checked={vault.rules.roundUpTransfers}
          onCheckedChange={(v) => updateVaultRule('roundUpTransfers', v)}
        />
        <RuleRow
          title="Round up swaps"
          description="Extract the difference to nearest $1 from swap results."
          checked={vault.rules.roundUpSwaps}
          onCheckedChange={(v) => updateVaultRule('roundUpSwaps', v)}
        />
        <RuleRow
          title="Save incoming funds"
          description="Automatically save a percentage of incoming transfers."
          checked={vault.rules.percentageIncoming}
          onCheckedChange={(v) => updateVaultRule('percentageIncoming', v)}
        />
      </CardContent>
    </Card>
  )
}

function RuleRow({ title, description, checked, onCheckedChange }: {
  title: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <h4 className="font-semibold text-sm">{title}</h4>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
