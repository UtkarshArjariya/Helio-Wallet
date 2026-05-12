import { useEffect, useState } from 'react'

/**
 * Launch-mode preference for the toolbar action.
 *
 *  - `popup`   — classic browser-action popup (~400×600).
 *  - `sidebar` — Chrome 114+ side panel (persistent column).
 *  - `tab`     — full browser tab.
 *
 * The service worker also reads this key (`helio:launch-mode`) and reconfigures
 * chrome.action.setPopup + chrome.sidePanel.setPanelBehavior accordingly. So
 * writes here from Settings take effect on the next icon click.
 *
 * In an extension context the source of truth is chrome.storage.local. In dev
 * (Vite preview, Vercel, etc.) we fall back to window.localStorage so the
 * Settings sub-page still works for visual testing.
 */

export type LaunchMode = 'popup' | 'sidebar' | 'tab'
export const LAUNCH_MODE_KEY = 'helio:launch-mode'
export const LAUNCH_MODE_DEFAULT: LaunchMode = 'sidebar'

const isMode = (v: unknown): v is LaunchMode =>
  v === 'popup' || v === 'sidebar' || v === 'tab'

const hasChromeStorage = (): boolean =>
  typeof chrome !== 'undefined' && !!chrome.storage?.local

export async function readLaunchMode(): Promise<LaunchMode> {
  if (hasChromeStorage()) {
    try {
      const out = await chrome.storage.local.get(LAUNCH_MODE_KEY)
      const v = out[LAUNCH_MODE_KEY]
      if (isMode(v)) return v
    } catch { /* */ }
  }
  try {
    const raw = localStorage.getItem(LAUNCH_MODE_KEY)
    if (raw) {
      const v = JSON.parse(raw)
      if (isMode(v)) return v
    }
  } catch { /* */ }
  return LAUNCH_MODE_DEFAULT
}

export async function writeLaunchMode(mode: LaunchMode): Promise<void> {
  if (hasChromeStorage()) {
    try { await chrome.storage.local.set({ [LAUNCH_MODE_KEY]: mode }) } catch { /* */ }
  }
  try { localStorage.setItem(LAUNCH_MODE_KEY, JSON.stringify(mode)) } catch { /* */ }
}

/** React hook: returns [mode, setMode] with cross-tab + cross-context sync. */
export function useLaunchMode(): [LaunchMode, (m: LaunchMode) => void, boolean] {
  const [mode, setMode]       = useState<LaunchMode>(LAUNCH_MODE_DEFAULT)
  const [loaded, setLoaded]   = useState(false)

  useEffect(() => {
    let cancelled = false
    readLaunchMode().then(v => {
      if (cancelled) return
      setMode(v); setLoaded(true)
    })

    // Mirror chrome.storage changes (e.g. another open tab updated the value)
    let off: (() => void) | undefined
    if (hasChromeStorage() && chrome.storage.onChanged?.addListener) {
      const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
        if (area !== 'local' || !changes[LAUNCH_MODE_KEY]) return
        const v = changes[LAUNCH_MODE_KEY].newValue
        if (isMode(v)) setMode(v)
      }
      chrome.storage.onChanged.addListener(handler)
      off = () => chrome.storage.onChanged.removeListener(handler)
    }

    return () => { cancelled = true; off?.() }
  }, [])

  const set = (m: LaunchMode) => {
    setMode(m)
    void writeLaunchMode(m)
  }
  return [mode, set, loaded]
}
