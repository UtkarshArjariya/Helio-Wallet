import React from 'react'
import { ScreenHeader } from '../../components/wallet/ui/ScreenHeader'
import { SettingsSection, OptionRow } from '../../components/wallet/settings/SettingsPrimitives'
import { AUTOLOCK_OPTIONS, useAutoLock, type AutoLockMs } from '../../lib/preferences'

export function AutoLockSettingsScreen() {
  const [current, setCurrent] = useAutoLock()

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Auto-lock" subtitle="Lock the wallet after inactivity" />
      <div className="p-4 space-y-4">
        <SettingsSection label="Lock after">
          {AUTOLOCK_OPTIONS.map((o) => (
            <OptionRow<AutoLockMs>
              key={o.value}
              label={o.label}
              sub={
                o.value === 0
                  ? 'Wallet stays unlocked until you lock it manually'
                  : 'Re-enter password to unlock'
              }
              value={o.value}
              current={current}
              onSelect={setCurrent}
            />
          ))}
        </SettingsSection>
        <p className="text-text-muted text-[11px] px-1 leading-relaxed">
          Auto-lock applies to your encrypted vault on this device. The session keypair is always cleared when you close the tab.
        </p>
      </div>
    </div>
  )
}
