/**
 * Session-scoped secret-key store.
 *
 * Bridges two storage backends behind a synchronous, cached API:
 *
 *  - In a Chrome extension context, the real backing store is
 *    `chrome.storage.session` — an in-memory, per-extension store that is
 *    shared across all extension documents (popup, side panel, full tab,
 *    service worker) and survives popup open/close cycles. It's cleared
 *    only when the browser fully quits.
 *
 *  - In a plain web context (Vite preview, Vercel deploy) there is no
 *    `chrome.storage.session`, so it falls back to `window.sessionStorage`
 *    (per-tab, survives reloads inside the same tab). The two backends are
 *    mutually exclusive: the extension NEVER mirrors the raw secret to
 *    `sessionStorage`, so the key can be zeroed and does not outlive its
 *    backing store (CLAUDE.md §5).
 *
 * Why a cache? `chrome.storage.session` is async-only, but the wallet code
 * (router init, useState defaults, etc.) reads the secret synchronously.
 * `hydrateSecretCache()` MUST be awaited once during app boot before any
 * render touches the store; from then on, reads come straight from the
 * in-memory cache.
 */

const KEY = 'helio:secret';

let cache: Uint8Array | null = null;
let hydrated: boolean = false;

function hasChromeSession(): boolean {
  return typeof chrome !== 'undefined' && !!chrome?.storage?.session;
}

/** Load the secret from the backing store into the in-memory cache. Call
 *  exactly once during app boot, before `createRoot().render()`. */
export async function hydrateSecretCache(): Promise<void> {
  if (hydrated) return;
  try {
    if (hasChromeSession()) {
      const out = await chrome.storage.session.get(KEY);
      const stored = out[KEY] as string | undefined;
      if (stored) cache = Uint8Array.from(JSON.parse(stored));
      // Wipe any legacy raw-secret mirror an older build may have left in
      // sessionStorage; the extension now persists ONLY to chrome.storage.session.
      try {
        sessionStorage.removeItem(KEY);
      } catch {
        /* */
      }
    } else if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(KEY);
      if (raw) cache = Uint8Array.from(JSON.parse(raw));
    }
  } catch {
    /* ignore corrupt blobs */
  }
  hydrated = true;
}

/** Persist the secret to the single appropriate backend for the runtime. */
export function saveSecret(secret: Uint8Array): void {
  cache = new Uint8Array(secret);
  const json = JSON.stringify(Array.from(secret));
  if (hasChromeSession()) {
    void chrome.storage.session.set({ [KEY]: json }).catch(() => {
      /* */
    });
  } else {
    // Web fallback ONLY. In the extension the raw secret lives solely in
    // chrome.storage.session — never mirrored to sessionStorage — so it can be
    // zeroed and never outlives that backend (CLAUDE.md §5).
    try {
      sessionStorage.setItem(KEY, json);
    } catch {
      /* */
    }
  }
}

/** Synchronous read — returns a fresh copy so callers can't mutate the cache. */
export function loadSecret(): Uint8Array | null {
  return cache ? new Uint8Array(cache) : null;
}

export function clearSecret(): void {
  cache = null;
  if (hasChromeSession()) {
    void chrome.storage.session.remove(KEY).catch(() => {
      /* */
    });
  }
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* */
  }
}

/** Cheap unlocked-check that doesn't allocate a copy. */
export function hasSecret(): boolean {
  return cache !== null;
}
