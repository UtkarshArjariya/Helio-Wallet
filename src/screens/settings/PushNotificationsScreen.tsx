import React from 'react'
import { ScreenHeader } from '../../components/wallet/ui/ScreenHeader'
import { SettingsSection, ToggleRow, SettingsDivider } from '../../components/wallet/settings/SettingsPrimitives'
import { useNotifications } from '../../lib/preferences'

export function PushNotificationsScreen() {
  const [prefs, setPrefs] = useNotifications()
  const set = <K extends keyof typeof prefs>(key: K, value: typeof prefs[K]) =>
    setPrefs({ ...prefs, [key]: value })

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Push notifications" subtitle="Browser-level alerts" />

      <div className="p-4 space-y-4">
        <SettingsSection label="Channel">
          <ToggleRow
            label="Enable push notifications"
            sub="Receive system alerts even when this tab is closed."
            checked={prefs.push}
            onChange={(v) => set('push', v)}
          />
        </SettingsSection>

        <SettingsSection label="Categories">
          <ToggleRow
            label="Transaction confirmed"
            sub="A signed send, swap, or stake successfully landed on-chain."
            checked={prefs.transactionConfirmed && prefs.push}
            onChange={(v) => set('transactionConfirmed', v)}
          />
          <SettingsDivider />
          <ToggleRow
            label="Vault threshold reached"
            sub="Your vault hit its deploy threshold and is auto-staking."
            checked={prefs.vaultThresholdReached && prefs.push}
            onChange={(v) => set('vaultThresholdReached', v)}
          />
          <SettingsDivider />
          <ToggleRow
            label="Vault rewards"
            sub="Staking rewards arrived in your reserve."
            checked={prefs.vaultRewards && prefs.push}
            onChange={(v) => set('vaultRewards', v)}
          />
          <SettingsDivider />
          <ToggleRow
            label="Price alerts"
            sub="Significant moves in tokens you hold."
            checked={prefs.priceAlerts && prefs.push}
            onChange={(v) => set('priceAlerts', v)}
          />
        </SettingsSection>

        {!prefs.push && (
          <p className="text-text-muted text-[11px] px-1 leading-relaxed">
            Push is disabled. Categories above will resume once you re-enable the channel.
          </p>
        )}
      </div>
    </div>
  )
}
