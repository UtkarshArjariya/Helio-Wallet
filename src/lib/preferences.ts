/**
 * Helio wallet local preferences.
 *
 * Each preference is a simple typed string stored in localStorage. Reads
 * fall back to a sensible default. Writes are synchronous + idempotent.
 */

import { useEffect, useState } from 'react'

export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'pt-BR' | 'zh-Hans'
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'INR' | 'BRL' | 'AUD'
export type NetworkCode  = 'mainnet' | 'testnet' | 'devnet'
export type ThemeCode    = 'solar-midnight' | 'pure-noir' | 'cosmic-blue'
export type AutoLockMs   = 60_000 | 300_000 | 900_000 | 1_800_000 | 3_600_000 | 0

export interface NotificationPrefs {
  push: boolean
  vaultThresholdReached: boolean
  vaultRewards: boolean
  priceAlerts: boolean
  transactionConfirmed: boolean
}

const KEY = {
  language:      'helio:pref:language',
  currency:      'helio:pref:currency',
  network:       'helio:pref:network',
  theme:         'helio:pref:theme',
  autoLock:      'helio:pref:autolock',
  notifications: 'helio:pref:notifications',
} as const

const DEFAULTS = {
  language: 'en'              as LanguageCode,
  currency: 'USD'             as CurrencyCode,
  network:  'devnet'          as NetworkCode,
  theme:    'solar-midnight'  as ThemeCode,
  autoLock: 300_000           as AutoLockMs,
  notifications: {
    push:                  true,
    vaultThresholdReached: true,
    vaultRewards:          true,
    priceAlerts:           true,
    transactionConfirmed:  true,
  } as NotificationPrefs,
}

function read<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
  // Cross-tab + cross-hook notification
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('helio:pref', { detail: { key, value } }))
  }
}

/** React hook over a preference key — re-renders when the key changes. */
export function usePref<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => read(key, fallback))
  useEffect(() => {
    const onChange = (e: Event) => {
      const ce = e as CustomEvent<{ key: string; value: T }>
      if (ce.detail?.key === key) setValue(ce.detail.value)
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setValue(read(key, fallback))
    }
    window.addEventListener('helio:pref', onChange)
    window.addEventListener('storage',    onStorage)
    return () => {
      window.removeEventListener('helio:pref', onChange)
      window.removeEventListener('storage',    onStorage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const set = (v: T) => { write(key, v); setValue(v) }
  return [value, set]
}

/* ── Typed hooks ────────────────────────────────────────────────────────────── */

export const useLanguage      = () => usePref<LanguageCode>(KEY.language, DEFAULTS.language)
export const useCurrency      = () => usePref<CurrencyCode>(KEY.currency, DEFAULTS.currency)
export const useNetwork       = () => usePref<NetworkCode> (KEY.network,  DEFAULTS.network)
export const useTheme         = () => usePref<ThemeCode>   (KEY.theme,    DEFAULTS.theme)
export const useAutoLock      = () => usePref<AutoLockMs>  (KEY.autoLock, DEFAULTS.autoLock)
export const useNotifications = () => usePref<NotificationPrefs>(KEY.notifications, DEFAULTS.notifications)

/* ── Static catalogues ──────────────────────────────────────────────────────── */

export const LANGUAGES: { code: LanguageCode; label: string; native: string }[] = [
  { code: 'en',      label: 'English',             native: 'English' },
  { code: 'es',      label: 'Spanish',             native: 'Español' },
  { code: 'fr',      label: 'French',              native: 'Français' },
  { code: 'de',      label: 'German',              native: 'Deutsch' },
  { code: 'ja',      label: 'Japanese',            native: '日本語' },
  { code: 'pt-BR',   label: 'Portuguese (Brazil)', native: 'Português' },
  { code: 'zh-Hans', label: 'Chinese (Simplified)', native: '简体中文' },
]

export const CURRENCIES: { code: CurrencyCode; label: string; symbol: string }[] = [
  { code: 'USD', label: 'US Dollar',        symbol: '$' },
  { code: 'EUR', label: 'Euro',             symbol: '€' },
  { code: 'GBP', label: 'British Pound',    symbol: '£' },
  { code: 'JPY', label: 'Japanese Yen',     symbol: '¥' },
  { code: 'CAD', label: 'Canadian Dollar',  symbol: 'C$' },
  { code: 'INR', label: 'Indian Rupee',     symbol: '₹' },
  { code: 'BRL', label: 'Brazilian Real',   symbol: 'R$' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
]

export const NETWORKS: { code: NetworkCode; label: string; subtitle: string }[] = [
  { code: 'mainnet', label: 'Mainnet Beta', subtitle: 'Real SOL · production' },
  { code: 'testnet', label: 'Testnet',      subtitle: 'Pre-release · resettable' },
  { code: 'devnet',  label: 'Devnet',       subtitle: 'Developer airdrops · resettable' },
]

export const THEMES: { code: ThemeCode; label: string; description: string; swatch: [string, string, string] }[] = [
  { code: 'solar-midnight', label: 'Solar Midnight', description: 'Default · lime on jet', swatch: ['#000000', '#C6F000', '#1A1FB8'] },
  { code: 'pure-noir',       label: 'Pure Noir',      description: 'Monochrome · pure restraint', swatch: ['#000000', '#FFFFFF', '#7A7A7A'] },
  { code: 'cosmic-blue',     label: 'Cosmic Blue',    description: 'Royal blue dominant',         swatch: ['#000000', '#1A1FB8', '#C6F000'] },
]

export const AUTOLOCK_OPTIONS: { value: AutoLockMs; label: string }[] = [
  { value: 60_000,    label: '1 minute' },
  { value: 300_000,   label: '5 minutes' },
  { value: 900_000,   label: '15 minutes' },
  { value: 1_800_000, label: '30 minutes' },
  { value: 3_600_000, label: '1 hour' },
  { value: 0,              label: 'Never' },
]
