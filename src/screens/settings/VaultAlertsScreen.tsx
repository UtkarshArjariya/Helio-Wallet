import React from 'react'
import { ScreenHeader } from '../../components/wallet/ui/ScreenHeader'
import { SettingsSection, ToggleRow, SettingsDivider } from '../../components/wallet/settings/SettingsPrimitives'
import { useNotifications } from '../../lib/preferences'

export function VaultAlertsScreen() {
  const [prefs, setPrefs] = useNotifications()
  const set = <K extends keyof typeof prefs>(key: K, value: typeof prefs[K]) =>
    setPrefs({ ...prefs, [key]: value })

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Vault alerts" subtitle="Notify me when…" />

      <div className="p-4 space-y-4">
        <SettingsSection label="Triggers">
          <ToggleRow
            label="Threshold reached"
            sub="Vault balance hits the deploy threshold and is about to auto-stake."
            checked={prefs.vaultThresholdReached}
            onChange={(v) => set('vaultThresholdReached', v)}
          />
          <SettingsDivider />
          <ToggleRow
            label="Rewards received"
            sub="Staking rewards arrived in your reserve."
            checked={prefs.vaultRewards}
            onChange={(v) => set('vaultRewards', v)}
          />
        </SettingsSection>

        <p className="text-text-muted text-[11px] px-1 leading-relaxed">
          Alerts surface in the notifications panel (top-right bell). Push delivery follows the {' '}
          <span className="text-text-secondary">Push notifications</span> setting.
        </p>
      </div>
    </div>
  )
}
