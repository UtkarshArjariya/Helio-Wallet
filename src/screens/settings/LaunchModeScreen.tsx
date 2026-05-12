import React from 'react'
import { Check, ExternalLink, Maximize2, PanelRight, SquareMousePointer } from 'lucide-react'
import { ScreenHeader } from '../../components/wallet/ui/ScreenHeader'
import { SettingsSection } from '../../components/wallet/settings/SettingsPrimitives'
import { useLaunchMode, type LaunchMode } from '../../lib/launch-mode'
import { cn } from '../../lib/utils'

interface ModeOption {
  value: LaunchMode
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const OPTIONS: ModeOption[] = [
  {
    value: 'sidebar',
    label: 'Side panel',
    description: 'Persistent column on the right of the browser. Stays open while you browse — best for active trading.',
    icon: PanelRight,
  },
  {
    value: 'popup',
    label: 'Popup',
    description: 'Classic toolbar popup. Compact, opens above the page, dismisses when you click away.',
    icon: SquareMousePointer,
  },
  {
    value: 'tab',
    label: 'Full tab',
    description: 'Opens in a regular browser tab — the most room for the vault dashboard and activity views.',
    icon: Maximize2,
  },
]

export function LaunchModeScreen() {
  const [mode, setMode] = useLaunchMode()

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Launch mode" subtitle="How the wallet opens from the toolbar" />

      <div className="p-4 space-y-4">
        <SettingsSection label="Open as">
          {OPTIONS.map(opt => {
            const Icon = opt.icon
            const active = opt.value === mode
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMode(opt.value)}
                className="flex w-full items-start gap-3 px-4 py-3.5 hover:bg-surface-3 transition-colors text-left"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary shrink-0 mt-0.5"
                  style={{ background: 'var(--surface-3)' }}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-sm font-medium', active ? 'text-text-primary' : 'text-text-secondary')}>
                      {opt.label}
                    </span>
                    {active && (
                      <span className="rounded-full bg-accent-primary text-accent-primary-foreground text-[9px] font-bold px-1.5 py-0.5 leading-none inline-flex items-center gap-0.5">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-text-muted text-xs mt-1 leading-relaxed">{opt.description}</p>
                </div>
              </button>
            )
          })}
        </SettingsSection>

        <div className="flex items-start gap-2 rounded-2xl border p-3 text-xs"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
          <ExternalLink className="h-3.5 w-3.5 mt-0.5 text-text-muted shrink-0" />
          <span className="text-text-muted leading-relaxed">
            Side panel requires Chrome 114 or newer. On unsupported browsers the wallet falls back to popup mode automatically.
          </span>
        </div>

        <p className="text-text-muted text-[11px] px-1 leading-relaxed">
          Changes take effect the next time you click the Helio icon in your browser toolbar.
        </p>
      </div>
    </div>
  )
}
