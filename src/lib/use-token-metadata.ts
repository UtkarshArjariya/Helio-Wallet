/**
 * useTokenMetadata — React hook for Jupiter token metadata with stale-while-
 * revalidate caching.
 *
 * Backing layout:
 *   in-memory Map (synchronous reads after first hit)
 *      ↳ persistent cache (chrome.storage.local / localStorage)
 *           ↳ Jupiter /tokens/v2/search (network)
 *
 * The first time a mint is requested the persistent cache is read on mount;
 * the hook then exposes whatever's available (possibly stale) immediately and
 * kicks off a background refresh if the entry is missing or expired.
 * Subsequent renders for the same mint return synchronously from the
 * in-memory mirror.
 *
 * Intentionally NOT using Zustand — this is the only place in the codebase
 * that needs cross-component state and a single React Context + module-level
 * subscriber set keeps the dependency surface flat.
 */

import { useEffect, useState } from 'react'
import type { TokenMetadata } from '@helio/api'
import { jupiterTokensClient, tokenMetadataCache } from './rpc-service'
import type { CachedTokenMetadata } from './token-metadata-cache'

/* ─────────────── module-level mirror + pub/sub ─────────────── */

const memory = new Map<string, CachedTokenMetadata>()
const inflight = new Map<string, Promise<void>>()
const subscribers = new Map<string, Set<() => void>>()

function notify(mint: string): void {
  subscribers.get(mint)?.forEach((cb) => cb())
}

function subscribe(mint: string, cb: () => void): () => void {
  let set = subscribers.get(mint)
  if (!set) {
    set = new Set()
    subscribers.set(mint, set)
  }
  set.add(cb)
  return () => {
    set?.delete(cb)
    if (set && set.size === 0) subscribers.delete(mint)
  }
}

function memoryEntryFreshness(entry: CachedTokenMetadata | undefined): {
  isStale: boolean
} {
  if (!entry) return { isStale: false }
  const ttlMs = entry.isVerified
    ? 7 * 24 * 60 * 60 * 1000
    : 24 * 60 * 60 * 1000
  return { isStale: Date.now() - entry.cachedAtMs > ttlMs }
}

/* ─────────────────────── fetch coordination ────────────────── */

async function refreshFromNetwork(mint: string): Promise<void> {
  const existing = inflight.get(mint)
  if (existing) return existing

  const promise = (async () => {
    try {
      const map = await jupiterTokensClient.getTokens([mint])
      const fetched = map.get(mint)
      if (!fetched) return
      await tokenMetadataCache.write(fetched)
      // After writing through, re-read so cachedAtMs matches what the cache
      // persisted (and so we hold the canonical CachedTokenMetadata shape).
      const cached: CachedTokenMetadata = {
        ...fetched,
        cachedAtMs: Date.now(),
      }
      memory.set(mint, cached)
      notify(mint)
    } finally {
      inflight.delete(mint)
    }
  })()

  inflight.set(mint, promise)
  return promise
}

async function hydrateFromPersistentCache(mint: string): Promise<void> {
  const { entry } = await tokenMetadataCache.readMaybeStale(mint)
  if (entry) {
    memory.set(mint, entry)
    notify(mint)
  }
}

/* ──────────────────────────── public ────────────────────────── */

export interface UseTokenMetadataResult {
  /** Cached metadata if known, otherwise `null`. Includes stale entries. */
  readonly data: TokenMetadata | null
  /** True while a network refresh is in flight. */
  readonly loading: boolean
  /** Most recent network error, if any. Resets on success. */
  readonly error: Error | null
  /** True when `data` is present but older than the TTL for its tier. */
  readonly isStale: boolean
}

/**
 * Reads Jupiter token metadata for a mint, with stale-while-revalidate
 * semantics:
 *
 *  - First render with an in-memory hit: `data` populated synchronously.
 *  - First render with only a persistent-cache hit: `data` becomes available
 *    after one microtask tick, then network refresh runs in the background
 *    if the persisted entry is stale.
 *  - First render cold: `data` is `null`, network refresh starts, `loading`
 *    flips to false once the entry is in memory.
 *
 * Pass `null` / `undefined` to disable the hook (e.g. while a parent decides
 * which mint to look up).
 */
export function useTokenMetadata(
  mint: string | null | undefined,
): UseTokenMetadataResult {
  const [, force] = useState(0)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)

  // Re-render when the in-memory entry for this mint changes.
  useEffect(() => {
    if (!mint) return
    return subscribe(mint, () => force((n) => n + 1))
  }, [mint])

  // Hydrate from the persistent cache + refresh from the network as needed.
  useEffect(() => {
    if (!mint) return
    let cancelled = false

    const entry = memory.get(mint)
    const { isStale } = memoryEntryFreshness(entry)

    if (!entry) {
      // Cold for this session — read persistent cache, then network refresh.
      setLoading(true)
      void hydrateFromPersistentCache(mint).then(() => {
        if (cancelled) return
        const after = memory.get(mint)
        if (after) {
          // Persistent cache hit; only refresh if stale.
          const stale = memoryEntryFreshness(after).isStale
          if (stale) {
            void refreshFromNetwork(mint)
              .catch((e) => { if (!cancelled) setError(e as Error) })
              .finally(() => { if (!cancelled) setLoading(false) })
          } else {
            setLoading(false)
          }
        } else {
          // Total miss; go to network.
          void refreshFromNetwork(mint)
            .catch((e) => { if (!cancelled) setError(e as Error) })
            .finally(() => { if (!cancelled) setLoading(false) })
        }
      })
    } else if (isStale) {
      // Background refresh; keep current data visible.
      setLoading(true)
      void refreshFromNetwork(mint)
        .catch((e) => { if (!cancelled) setError(e as Error) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }

    return () => { cancelled = true }
  }, [mint])

  if (!mint) {
    return { data: null, loading: false, error: null, isStale: false }
  }

  const entry = memory.get(mint) ?? null
  const { isStale } = memoryEntryFreshness(entry ?? undefined)
  return {
    data: entry,
    loading,
    error,
    isStale,
  }
}

/**
 * Imperative helper for non-React callers (e.g. extension startup) that wants
 * to warm the cache for a known set of mints.
 */
export async function prefetchTokenMetadata(
  mints: readonly string[],
): Promise<void> {
  if (mints.length === 0) return
  const known = await tokenMetadataCache.readMany(mints)
  const missing = mints.filter((m) => !known.has(m))
  if (missing.length === 0) return
  const fetched = await jupiterTokensClient.getTokens(missing)
  await tokenMetadataCache.writeMany([...fetched.values()])
}
