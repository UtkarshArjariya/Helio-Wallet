/**
 * Token metadata cache.
 *
 * Persists Jupiter Tokens v2 metadata locally so subsequent renders / loads
 * don't re-hit the network. Two storage adapters share one cache interface:
 *
 *  - `chrome.storage.local` when running inside the Chrome extension
 *  - browser `localStorage` for the web build (Vite dev server, public site)
 *
 * Key layout:  `token:meta:<mint>` → { ...TokenMetadata, fetchedAt }
 * TTL:         7 days for verified tokens, 24h for everything else.
 * Eviction:    cap of `MAX_ENTRIES`; oldest `fetchedAt` evicted first.
 * Icons:       we only store the icon URL, never bytes — the browser's HTTP
 *              cache handles image data far more efficiently than re-encoded
 *              base64 in chrome.storage.local (which has a 5-MB quota).
 *
 * Designed to be runtime-agnostic. Tests parameterize the same suite over both
 * adapters with an in-memory fake to avoid touching real chrome.* / localStorage.
 */

import type { TokenMetadata } from "@helio/api";

const KEY_PREFIX = "token:meta:";
const TTL_VERIFIED_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const TTL_UNVERIFIED_MS = 24 * 60 * 60 * 1000;    // 24 hours
const MAX_ENTRIES = 1000;

/* ───────────────────────── adapter contract ───────────────────────── */

/**
 * Minimal key/value contract shared by the two real adapters and the in-memory
 * test fake. Multi-key methods accept the full key (including prefix); the
 * cache layer is the only consumer that knows about the `token:meta:` prefix.
 */
export interface TokenStorageAdapter {
  /** Reads a value. Returns `null` if absent. */
  get(key: string): Promise<string | null>;
  /** Upserts a value. */
  set(key: string, value: string): Promise<void>;
  /** Deletes a single key (idempotent). */
  remove(key: string): Promise<void>;
  /** Returns all keys with the given prefix. */
  listKeys(prefix: string): Promise<readonly string[]>;
  /** Bulk delete (idempotent). */
  removeMany(keys: readonly string[]): Promise<void>;
}

/* ──────────────────────── chrome.storage adapter ──────────────────── */

function isChromeStorageAvailable(): boolean {
  return (
    typeof chrome !== "undefined" &&
    chrome?.storage?.local !== undefined
  );
}

/**
 * Adapter backed by `chrome.storage.local`. Used inside the Chrome extension
 * because chrome.storage survives extension restarts and is shared across the
 * extension's background / content / popup contexts.
 */
export function createChromeStorageAdapter(): TokenStorageAdapter {
  const area = chrome.storage.local;
  return {
    async get(key) {
      const result = await area.get(key);
      const value = result[key];
      return typeof value === "string" ? value : null;
    },
    async set(key, value) {
      await area.set({ [key]: value });
    },
    async remove(key) {
      await area.remove(key);
    },
    async listKeys(prefix) {
      const all = await area.get(null);
      return Object.keys(all).filter((k) => k.startsWith(prefix));
    },
    async removeMany(keys) {
      if (keys.length === 0) return;
      await area.remove([...keys]);
    },
  };
}

/* ──────────────────────── localStorage adapter ────────────────────── */

/**
 * Adapter backed by web `localStorage`. Used when running outside the
 * extension (Vite dev server, web build). Synchronous under the hood but
 * exposed via the async contract so the cache layer can treat both adapters
 * uniformly.
 */
export function createLocalStorageAdapter(): TokenStorageAdapter {
  if (typeof localStorage === "undefined") {
    throw new Error("localStorage is not available in this runtime");
  }
  return {
    async get(key) {
      return localStorage.getItem(key);
    },
    async set(key, value) {
      localStorage.setItem(key, value);
    },
    async remove(key) {
      localStorage.removeItem(key);
    },
    async listKeys(prefix) {
      const out: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) out.push(k);
      }
      return out;
    },
    async removeMany(keys) {
      for (const k of keys) localStorage.removeItem(k);
    },
  };
}

/**
 * Picks the best available adapter for the current runtime — chrome.storage
 * inside the extension, localStorage on the web.
 */
export function createDefaultStorageAdapter(): TokenStorageAdapter {
  return isChromeStorageAvailable()
    ? createChromeStorageAdapter()
    : createLocalStorageAdapter();
}

/* ─────────────────────────── cache layer ──────────────────────────── */

/** Public, immutable record persisted per mint. */
export interface CachedTokenMetadata extends TokenMetadata {
  /** Wall-clock time at which the entry was written (ms since epoch). */
  readonly cachedAtMs: number;
}

function keyFor(mint: string): string {
  return `${KEY_PREFIX}${mint}`;
}

function ttlForEntry(entry: { isVerified: boolean }): number {
  return entry.isVerified ? TTL_VERIFIED_MS : TTL_UNVERIFIED_MS;
}

function isStale(entry: CachedTokenMetadata, now: number): boolean {
  return now - entry.cachedAtMs > ttlForEntry(entry);
}

function safeParse(raw: string | null): CachedTokenMetadata | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as CachedTokenMetadata;
    if (typeof parsed?.mint !== "string") return null;
    if (typeof parsed?.cachedAtMs !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export interface TokenMetadataCache {
  /**
   * Reads a fresh cache entry. Returns `null` if absent OR stale (so the
   * caller knows to refetch). Use {@link readMaybeStale} when you want to
   * return-and-revalidate.
   */
  read(mint: string): Promise<CachedTokenMetadata | null>;
  /**
   * Returns whatever is cached for the mint, even if stale, plus an
   * `isStale` flag. Useful for stale-while-revalidate hooks.
   */
  readMaybeStale(mint: string): Promise<{
    entry: CachedTokenMetadata | null;
    isStale: boolean;
  }>;
  /** Upserts the entry with `cachedAtMs = now`. */
  write(metadata: TokenMetadata): Promise<void>;
  /** Bulk read for a batch of mints — returns a partial map. */
  readMany(
    mints: readonly string[],
  ): Promise<ReadonlyMap<string, CachedTokenMetadata>>;
  /** Bulk write. */
  writeMany(metadatas: readonly TokenMetadata[]): Promise<void>;
  /** Removes all token entries (Settings → Clear cache). */
  clearTokenCache(): Promise<void>;
  /**
   * Walks all entries, drops expired ones, and trims the cache down to
   * `MAX_ENTRIES` (oldest `cachedAtMs` first). Cheap enough to call on
   * extension startup; idempotent.
   */
  pruneExpired(): Promise<{ removed: number; remaining: number }>;
}

export interface CreateTokenMetadataCacheOptions {
  /** Override the storage adapter — primarily for tests. */
  readonly adapter?: TokenStorageAdapter;
  /** Override the clock — primarily for tests. */
  readonly now?: () => number;
  /** Override the max-entries cap — primarily for tests. */
  readonly maxEntries?: number;
}

/**
 * Constructs a {@link TokenMetadataCache} bound to the given storage adapter.
 * Defaults to chrome.storage.local inside the extension, localStorage elsewhere.
 */
export function createTokenMetadataCache(
  options: CreateTokenMetadataCacheOptions = {},
): TokenMetadataCache {
  const adapter = options.adapter ?? createDefaultStorageAdapter();
  const now = options.now ?? (() => Date.now());
  const maxEntries = options.maxEntries ?? MAX_ENTRIES;

  return {
    async read(mint) {
      const entry = safeParse(await adapter.get(keyFor(mint)));
      if (!entry) return null;
      return isStale(entry, now()) ? null : entry;
    },

    async readMaybeStale(mint) {
      const entry = safeParse(await adapter.get(keyFor(mint)));
      if (!entry) return { entry: null, isStale: false };
      return { entry, isStale: isStale(entry, now()) };
    },

    async write(metadata) {
      const cached: CachedTokenMetadata = { ...metadata, cachedAtMs: now() };
      await adapter.set(keyFor(metadata.mint), JSON.stringify(cached));
      await enforceCap(adapter, maxEntries);
    },

    async readMany(mints) {
      const map = new Map<string, CachedTokenMetadata>();
      await Promise.all(
        mints.map(async (mint) => {
          const entry = safeParse(await adapter.get(keyFor(mint)));
          if (entry && !isStale(entry, now())) map.set(mint, entry);
        }),
      );
      return map;
    },

    async writeMany(metadatas) {
      const ts = now();
      await Promise.all(
        metadatas.map((meta) =>
          adapter.set(
            keyFor(meta.mint),
            JSON.stringify({ ...meta, cachedAtMs: ts } satisfies CachedTokenMetadata),
          ),
        ),
      );
      await enforceCap(adapter, maxEntries);
    },

    async clearTokenCache() {
      const keys = await adapter.listKeys(KEY_PREFIX);
      await adapter.removeMany(keys);
    },

    async pruneExpired() {
      const keys = await adapter.listKeys(KEY_PREFIX);
      const ts = now();
      const expired: string[] = [];

      const entries: { key: string; cachedAtMs: number }[] = [];
      await Promise.all(
        keys.map(async (k) => {
          const entry = safeParse(await adapter.get(k));
          if (!entry) {
            expired.push(k);
            return;
          }
          if (isStale(entry, ts)) {
            expired.push(k);
            return;
          }
          entries.push({ key: k, cachedAtMs: entry.cachedAtMs });
        }),
      );

      if (expired.length > 0) await adapter.removeMany(expired);

      // Cap enforcement: drop oldest by cachedAtMs until under the cap.
      let trimmed = 0;
      if (entries.length > maxEntries) {
        entries.sort((a, b) => a.cachedAtMs - b.cachedAtMs);
        const toDrop = entries.slice(0, entries.length - maxEntries);
        await adapter.removeMany(toDrop.map((e) => e.key));
        trimmed = toDrop.length;
      }

      return {
        removed: expired.length + trimmed,
        remaining: Math.min(entries.length, maxEntries),
      };
    },
  };
}

/**
 * Best-effort cap enforcement called after each write. Cheaper than a full
 * `pruneExpired()` sweep; only does work when the cache is over the cap.
 */
async function enforceCap(
  adapter: TokenStorageAdapter,
  maxEntries: number,
): Promise<void> {
  const keys = await adapter.listKeys(KEY_PREFIX);
  if (keys.length <= maxEntries) return;

  const entries: { key: string; cachedAtMs: number }[] = [];
  await Promise.all(
    keys.map(async (k) => {
      const entry = safeParse(await adapter.get(k));
      if (entry) entries.push({ key: k, cachedAtMs: entry.cachedAtMs });
    }),
  );

  entries.sort((a, b) => a.cachedAtMs - b.cachedAtMs);
  const toDrop = entries.slice(0, entries.length - maxEntries);
  await adapter.removeMany(toDrop.map((e) => e.key));
}

/* ───────────────────────── exposed constants ──────────────────────── */

export const TOKEN_CACHE_KEY_PREFIX = KEY_PREFIX;
export const TOKEN_CACHE_TTL_VERIFIED_MS = TTL_VERIFIED_MS;
export const TOKEN_CACHE_TTL_UNVERIFIED_MS = TTL_UNVERIFIED_MS;
export const TOKEN_CACHE_MAX_ENTRIES = MAX_ENTRIES;
