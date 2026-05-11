import React from 'react'
import { ScreenHeader } from '../../components/wallet/ui/ScreenHeader'
import { SettingsSection, OptionRow } from '../../components/wallet/settings/SettingsPrimitives'
import { CURRENCIES, useCurrency, type CurrencyCode } from '../../lib/preferences'

export function CurrencySettingsScreen() {
  const [current, setCurrent] = useCurrency()
  return (
    <div className="flex flex-col">
      <ScreenHeader title="Currency" subtitle="Display currency for fiat values" />
      <div className="p-4 space-y-4">
        <SettingsSection label="Fiat">
          {CURRENCIES.map((c) => (
            <OptionRow<CurrencyCode>
              key={c.code}
              label={`${c.label} (${c.code})`}
              sub={`Symbol · ${c.symbol}`}
              value={c.code}
              current={current}
              onSelect={setCurrent}
            />
          ))}
        </SettingsSection>
        <p className="text-text-muted text-[11px] px-1 leading-relaxed">
          Prices fetched in USD and converted client-side using the latest Jupiter/CoinGecko reference rates.
        </p>
      </div>
    </div>
  )
}
