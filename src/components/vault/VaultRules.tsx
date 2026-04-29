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
        <CardDescription>Configure how you want to accumulate spare change.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Rule 1: Round up transfers */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-semibold text-sm">Round up transfers</h4>
            <p className="text-xs text-text-muted">Round up outgoing SOL transfers to the nearest integer.</p>
          </div>
          <Switch 
            checked={vault.rules.roundUpTransfers !== null}
            onCheckedChange={(c) => updateVaultRule('roundUpTransfers', c ? 1 : null)}
          />
        </div>

        {/* Rule 2: Round up swaps */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-semibold text-sm">Round up swaps</h4>
            <p className="text-xs text-text-muted">Extract the difference to nearest $1 from swap results.</p>
          </div>
          <Switch 
            checked={vault.rules.roundUpSwaps !== null}
            onCheckedChange={(c) => updateVaultRule('roundUpSwaps', c ? 1 : null)}
          />
        </div>

        {/* Rule 3: Percentage of incoming */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-semibold text-sm">Save incoming funds</h4>
            <p className="text-xs text-text-muted">Automatically save a percentage of incoming transfers.</p>
          </div>
          <Switch 
            checked={vault.rules.percentageIncoming !== null}
            onCheckedChange={(c) => updateVaultRule('percentageIncoming', c ? 5 : null)}
          />
        </div>
      </CardContent>
    </Card>
  )
}
