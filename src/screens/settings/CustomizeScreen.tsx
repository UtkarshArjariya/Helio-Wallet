import React from 'react'
import { Check } from 'lucide-react'
import { ScreenHeader } from '../../components/wallet/ui/ScreenHeader'
import { SettingsSection } from '../../components/wallet/settings/SettingsPrimitives'
import { THEMES, useTheme, type ThemeCode } from '../../lib/preferences'
import { cn } from '../../lib/utils'

export function CustomizeScreen() {
  const [current, setCurrent] = useTheme()

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Customize" subtitle="Theme & visual identity" />

      <div className="p-4 space-y-4">
        <SettingsSection label="Theme">
          <div className="p-3 grid grid-cols-1 gap-2">
            {THEMES.map((t) => (
              <ThemeOption
                key={t.code}
                theme={t}
                active={current === t.code}
                onSelect={() => setCurrent(t.code)}
              />
            ))}
          </div>
        </SettingsSection>

        <p className="text-text-muted text-[11px] px-1 leading-relaxed">
          Theme selection is saved per-device. Only Solar Midnight is fully wired today; alternate themes ship in an upcoming release.
        </p>
      </div>
    </div>
  )
}

function ThemeOption({
  theme, active, onSelect,
}: {
  theme: typeof THEMES[number]
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
        active ? 'ring-2 ring-accent-primary' : 'hover:bg-surface-3',
      )}
      style={{
        background: 'var(--surface-2)',
        borderColor: active ? 'transparent' : 'var(--border-subtle)',
      }}
    >
      {/* Swatch — 3 stripes */}
      <div className="flex h-12 w-12 shrink-0 overflow-hidden rounded-xl"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}>
        {theme.swatch.map((color, i) => (
          <span key={i} className="flex-1" style={{ background: color }} />
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-medium', active ? 'text-text-primary' : 'text-text-secondary')}>
            {theme.label}
          </span>
          {active && (
            <span className="rounded-full bg-accent-primary text-accent-primary-foreground text-[9px] font-semibold px-1.5 py-0.5 inline-flex items-center gap-0.5">
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
              ACTIVE
            </span>
          )}
        </div>
        <div className="text-text-muted text-xs mt-0.5">{theme.description}</div>
      </div>
    </button>
  )
}
