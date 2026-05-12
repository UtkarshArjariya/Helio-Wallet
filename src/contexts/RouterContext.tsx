import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react'

export const WALLET_ADDRESS_KEY = 'helio:address'

type RouterContextType = {
  location:   string
  navigate:   (path: string, opts?: { replace?: boolean }) => void
  back:       () => void
  canGoBack:  boolean
}

const RouterContext = createContext<RouterContextType | undefined>(undefined)

// ── Path tables ─────────────────────────────────────────────────────────────
// Kept in sync with the switch in App.tsx. The lookup happens at boot so we can
// validate the URL the user reloaded on.

const ONBOARDING_PATHS = new Set<string>([
  '/welcome',
  '/import',
  '/import-private-key',
  '/create-password',
  '/seed-phrase',
  '/unlock',
])

const APP_PATHS = new Set<string>([
  '/', '/tokens',
  '/vault', '/swap', '/send', '/receive', '/activity', '/staking',
  '/settings',
  '/settings/language',
  '/settings/currency',
  '/settings/network',
  '/settings/customize',
  '/settings/address-book',
  '/settings/notifications',
  '/settings/vault-alerts',
  '/settings/manage-apps',
  '/settings/spending-approvals',
  '/settings/auto-lock',
  '/settings/launch-mode',
  '/settings/change-password',
  '/settings/export-recovery-phrase',
  '/settings/export-private-key',
])

/** Returns the parent route for sub-pages. Used by `back()` when the in-memory
 * stack is empty (e.g. user reloaded directly on a sub-page). */
function parentOf(path: string): string | null {
  if (path.startsWith('/settings/')) return '/settings'
  if (path.startsWith('/token/'))    return '/'
  return null
}

/** True for dynamic-segment app paths (e.g. /token/<id>). */
function isDynamicAppPath(path: string): boolean {
  return path.startsWith('/token/')
}

/** Strip extension-specific suffixes (e.g. `/popup.html`) from a path. */
function normalize(raw: string): string {
  if (!raw) return '/'
  const stripped = raw.replace(/\/(popup|index)\.html$/, '/').replace(/\/+$/, '')
  return stripped === '' ? '/' : stripped
}

/** Resolve the initial path based on URL + wallet state.
 *
 *  States (priority order):
 *  1. No wallet at all → fresh onboarding (`/welcome`).
 *  2. Wallet exists but no encrypted vault → legacy state, force re-import.
 *  3. Wallet + vault present but no live session → `/unlock`.
 *  4. Wallet + vault + live session → honour the URL (or `/`).
 */
function resolveInitialPath(): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return '/'

  const hasAddress = !!localStorage.getItem(WALLET_ADDRESS_KEY)
  const hasVault   = !!localStorage.getItem('helio:vault')
  const hasSession = (() => {
    try { return !!sessionStorage.getItem('helio:secret') } catch { return false }
  })()

  const path = normalize(window.location.pathname)

  // Case 1 — fresh install. Allow onboarding paths; everything else → welcome.
  if (!hasAddress) {
    return ONBOARDING_PATHS.has(path) ? path : '/welcome'
  }

  // Case 2 — address exists but no encrypted vault (legacy or corrupted state).
  // Allow the user to either restore via recovery phrase or wipe.
  if (!hasVault) {
    if (ONBOARDING_PATHS.has(path)) return path
    return '/unlock' // UnlockScreen detects missing vault and shows recovery CTA.
  }

  // Case 3 — wallet & vault exist but the in-memory session was cleared
  // (e.g. browser restart, tab closed). Must unlock with password.
  if (!hasSession) {
    // Permit `/import` so users can recover via phrase even when locked.
    if (path === '/import') return path
    return '/unlock'
  }

  // Case 4 — fully unlocked. Send onboarding routes back to home; otherwise
  // honour the URL if it's a valid app path.
  if (ONBOARDING_PATHS.has(path)) return '/'
  if (APP_PATHS.has(path) || isDynamicAppPath(path)) return path
  return '/'
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState<string>(resolveInitialPath)
  // Stack of previously-visited paths (most-recent at the end).
  const [stack,    setStack]    = useState<string[]>([])

  // Sync the URL bar with our resolved initial path on first mount — without
  // pushing a new history entry. This handles the "reload at /settings/foo
  // when wallet locked → snap to /welcome" case.
  useEffect(() => {
    try {
      if (normalize(window.location.pathname) !== location) {
        window.history.replaceState({ helio: true, path: location }, '', location)
      }
    } catch { /* */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Guards popstate handler so our own pushState calls don't bounce the stack.
  const internalNav = useRef(false)

  const navigate = useCallback((path: string, opts?: { replace?: boolean }) => {
    setLocation(prev => {
      if (prev === path) return prev
      if (!opts?.replace) setStack(s => [...s, prev])
      internalNav.current = true
      try {
        if (opts?.replace) {
          window.history.replaceState({ helio: true, path }, '', path)
        } else {
          window.history.pushState({ helio: true, path }, '', path)
        }
      } catch { /* extension popup may reject pushState */ }
      return path
    })
  }, [])

  const back = useCallback(() => {
    setStack(s => {
      if (s.length > 0) {
        const next = [...s]
        const prev = next.pop()!
        internalNav.current = true
        setLocation(prev)
        try { window.history.pushState({ helio: true, path: prev }, '', prev) } catch { /* */ }
        return next
      }
      // Empty stack — derive a sensible parent (e.g. /settings/X → /settings).
      // Use a functional read so we don't capture a stale `location`.
      setLocation(curr => {
        const target = parentOf(curr) ?? '/'
        internalNav.current = true
        try { window.history.pushState({ helio: true, path: target }, '', target) } catch { /* */ }
        return target
      })
      return s
    })
  }, [])

  // Browser/OS back button (popstate) hooks into the same stack-based back.
  useEffect(() => {
    function onPop() {
      if (internalNav.current) { internalNav.current = false; return }
      back()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [back])

  return (
    <RouterContext.Provider value={{ location, navigate, back, canGoBack: stack.length > 0 }}>
      {children}
    </RouterContext.Provider>
  )
}

export function useRouter() {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used within RouterProvider')
  return ctx
}
