import React from 'react'
import {
  Bell, ChevronRight, DollarSign, Globe, Languages, Lock, LogOut,
  Network, Palette, ShieldCheck, Sparkles, Timer, UsersRound,
} from 'lucide-react'
import { useRouter } from '../contexts/RouterContext'
import { useWallet, lockWallet } from '../contexts/WalletContext'
import { ScreenHeader } from '../components/wallet/ui/ScreenHeader'
import {
  AUTOLOCK_OPTIONS, CURRENCIES, LANGUAGES, NETWORKS, THEMES,
  useAutoLock, useCurrency, useLanguage, useNetwork, useTheme, useNotifications,
} from '../lib/preferences'

type Item = {
  id: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  sub?: string
  danger?: boolean
  path?: string
  onClick?: () => void
}

export function SettingsScreen() {
  const { navigate } = useRouter()
  const { name, shortAddress } = useWallet()

  const [language] = useLanguage()
  const [currency] = useCurrency()
  const [network]  = useNetwork()
  const [theme]    = useTheme()
  const [autolock] = useAutoLock()
  const [notifs]   = useNotifications()

  const langLabel    = LANGUAGES.find(l => l.code === language)?.label ?? 'English'
  const curLabel     = currency
  const networkLabel = NETWORKS.find(n => n.code === network)?.label ?? 'Mainnet Beta'
  const themeLabel   = THEMES.find(t => t.code === theme)?.label ?? 'Solar Midnight'
  const autolockLbl  = AUTOLOCK_OPTIONS.find(o => o.value === autolock)?.label ?? '5 minutes'
  const activeVaultAlerts = [notifs.vaultThresholdReached, notifs.vaultRewards].filter(Boolean).length

  const handleLock = () => {
    lockWallet()
    // If an encrypted vault exists, send the user to the password prompt;
    // otherwise drop back to onboarding.
    const hasVault = typeof localStorage !== 'undefined'
      && localStorage.getItem('helio:vault') !== null
    navigate(hasVault ? '/unlock' : '/welcome', { replace: true })
  }

  const sections: { title: string; items: Item[] }[] = [
    {
      title: 'General',
      items: [
        { id: 'language',     icon: Languages,  label: 'Language',     sub: langLabel,     path: '/settings/language' },
        { id: 'currency',     icon: DollarSign, label: 'Currency',     sub: curLabel,      path: '/settings/currency' },
        { id: 'network',      icon: Network,    label: 'Network',      sub: networkLabel,  path: '/settings/network' },
        { id: 'address-book', icon: UsersRound, label: 'Address book', sub: 'Manage saved contacts', path: '/settings/address-book' },
        { id: 'customize',    icon: Palette,    label: 'Customize',    sub: themeLabel,    path: '/settings/customize' },
      ],
    },
    {
      title: 'Notifications',
      items: [
        { id: 'push',  icon: Bell,      label: 'Push notifications', sub: notifs.push ? 'Enabled' : 'Disabled', path: '/settings/notifications' },
        { id: 'vault', icon: Sparkles,  label: 'Vault alerts',       sub: `${activeVaultAlerts} of 2 active`,  path: '/settings/vault-alerts' },
      ],
    },
    {
      title: 'Security & privacy',
      items: [
        { id: 'apps',      icon: ShieldCheck, label: 'Manage apps',         sub: 'No dApps connected',   path: '/settings/manage-apps' },
        { id: 'approvals', icon: ShieldCheck, label: 'Spending approvals',  sub: 'No standing approvals', path: '/settings/spending-approvals' },
        { id: 'autolock',  icon: Timer,       label: 'Auto-lock',           sub: `After ${autolockLbl}`, path: '/settings/auto-lock' },
        { id: 'password',  icon: Lock,        label: 'Change password',     path: '/settings/change-password' },
      ],
    },
    {
      title: 'About',
      items: [
        { id: 'terms',   icon: Globe,  label: 'Terms of service' },
        { id: 'privacy', icon: Globe,  label: 'Privacy policy' },
        { id: 'lock',    icon: LogOut, label: 'Lock & log out', danger: true, onClick: handleLock },
      ],
    },
  ]

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Settings" showBack={false} />

      <div className="p-4 space-y-4">
        {/* Wallet identity card */}
        <div className="rounded-3xl helio-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl helio-gradient-solar text-accent-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-text-primary font-heading font-semibold">{name}</div>
              <div className="text-text-muted text-xs font-mono">{shortAddress}</div>
            </div>
            <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] font-medium text-success border border-success/20">
              Connected
            </span>
          </div>
        </div>

        {sections.map(s => (
          <div key={s.title} className="rounded-3xl helio-card overflow-hidden">
            <div className="px-4 pt-3 pb-1 font-eyebrow text-text-muted text-[10px]">
              {s.title}
            </div>
            <div className="px-2 pb-2">
              {s.items.map(item => (
                <SettingsRow
                  key={item.id}
                  item={item}
                  onClick={
                    item.onClick
                      ? item.onClick
                      : item.path
                        ? () => navigate(item.path!)
                        : undefined
                  }
                />
              ))}
            </div>
          </div>
        ))}

        <div className="text-center text-text-muted text-[11px] py-2 font-mono">
          Helio Wallet · v0.1.0 · Mainnet
        </div>
      </div>
    </div>
  )
}

function SettingsRow({ item, onClick }: { item: Item; onClick?: () => void }) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-3 transition-colors text-left"
    >
      <span className={
        item.danger
          ? 'flex h-8 w-8 items-center justify-center rounded-xl bg-danger/10 text-danger'
          : 'flex h-8 w-8 items-center justify-center rounded-xl text-text-secondary'
      } style={item.danger ? {} : { background: 'var(--surface-3)' }}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className={item.danger ? 'text-danger text-sm font-medium' : 'text-text-primary text-sm font-medium'}>
          {item.label}
        </div>
        {item.sub && <div className="text-text-muted text-xs">{item.sub}</div>}
      </div>
      <ChevronRight className="h-4 w-4 text-text-muted shrink-0" />
    </button>
  )
}
