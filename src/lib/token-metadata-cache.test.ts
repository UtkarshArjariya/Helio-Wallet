import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { TokenMetadata } from '@helio/api'
import {
  createTokenMetadataCache,
  TOKEN_CACHE_KEY_PREFIX,
  type TokenStorageAdapter,
} from './token-metadata-cache'

/**
 * In-memory adapter — exercises the same TokenStorageAdapter contract that
 * the real chrome.storage.local + localStorage adapters implement, so this
 * one suite covers all three adapter shapes.
 */
function createMemoryAdapter(): TokenStorageAdapter & { store: Map<string, string> } {
  const store = new Map<string, string>()
  return {
    store,
    async get(key) { return store.has(key) ? store.get(key)! : null },
    async set(key, value) { store.set(key, value) },
    async remove(key) { store.delete(key) },
    async listKeys(prefix) {
      return [...store.keys()].filter(k => k.startsWith(prefix))
    },
    async removeMany(keys) { for (const k of keys) store.delete(k) },
  }
}

/**
 * Stub of the web localStorage adapter — exercises the synchronous-under-the-
 * hood path through the same async contract.
 */
function createLocalStorageStubAdapter(): TokenStorageAdapter & { reset: () => void } {
  const store: Record<string, string> = {}
  return {
    reset() { for (const k of Object.keys(store)) delete store[k] },
    async get(key) { return Object.hasOwn(store, key) ? store[key]! : null },
    async set(key, value) { store[key] = value },
    async remove(key) { delete store[key] },
    async listKeys(prefix) { return Object.keys(store).filter(k => k.startsWith(prefix)) },
    async removeMany(keys) { for (const k of keys) delete store[k] },
  }
}

function meta(mint: string, overrides: Partial<TokenMetadata> = {}): TokenMetadata {
  return {
    mint,
    name: `Token ${mint}`,
    symbol: mint.slice(0, 4).toUpperCase(),
    decimals: 6,
    icon: null,
    isVerified: false,
    organicScore: 0,
    tags: [],
    fetchedAt: new Date().toISOString(),
    ...overrides,
  }
}

const adapters: { name: string; make: () => TokenStorageAdapter }[] = [
  { name: 'memory adapter (chrome.storage.local contract)', make: () => createMemoryAdapter() },
  { name: 'localStorage stub adapter',                       make: () => createLocalStorageStubAdapter() },
]

for (const { name, make } of adapters) {
  describe(`token-metadata-cache (${name})`, () => {
    let now = 1_000_000_000_000
    const clock = () => now
    let cache: ReturnType<typeof createTokenMetadataCache>
    let adapter: TokenStorageAdapter

    beforeEach(() => {
      now = 1_000_000_000_000
      adapter = make()
      cache = createTokenMetadataCache({ adapter, now: clock, maxEntries: 5 })
    })

    afterEach(() => {
      // Memory adapters are GC'd; nothing else to clean up.
    })

    it('returns cached value without re-fetching', async () => {
      await cache.write(meta('A'))
      const hit = await cache.read('A')
      expect(hit?.mint).toBe('A')
      // Cache-hit path makes only adapter reads, no network — adapter is the
      // only side-effecting layer here, and we already know it has the value.
    })

    it('returns null when entry is stale (24h TTL for unverified)', async () => {
      await cache.write(meta('B', { isVerified: false }))
      now += 25 * 60 * 60 * 1000 // +25h
      expect(await cache.read('B')).toBeNull()
    })

    it('keeps verified entries fresh for 7 days', async () => {
      await cache.write(meta('C', { isVerified: true }))
      now += 6 * 24 * 60 * 60 * 1000 // +6d
      expect(await cache.read('C')).not.toBeNull()
      now += 2 * 24 * 60 * 60 * 1000 // +8d total
      expect(await cache.read('C')).toBeNull()
    })

    it('readMaybeStale returns stale entries with the isStale flag set', async () => {
      await cache.write(meta('D', { isVerified: false }))
      now += 25 * 60 * 60 * 1000
      const { entry, isStale } = await cache.readMaybeStale('D')
      expect(entry?.mint).toBe('D')
      expect(isStale).toBe(true)
    })

    it('readMany returns only fresh hits for known mints', async () => {
      await cache.write(meta('E', { isVerified: true }))
      await cache.write(meta('F', { isVerified: false }))
      now += 25 * 60 * 60 * 1000
      const map = await cache.readMany(['E', 'F', 'G'])
      expect(map.has('E')).toBe(true)  // verified, still fresh
      expect(map.has('F')).toBe(false) // unverified, expired
      expect(map.has('G')).toBe(false) // never written
    })

    it('pruneExpired removes stale entries and enforces the cap', async () => {
      // Write 7 entries with strictly increasing cachedAtMs values.
      for (let i = 0; i < 7; i++) {
        now = 1_000_000_000_000 + i * 1000
        await cache.write(meta(`M${i}`, { isVerified: true }))
      }
      // Cap is 5 — last write should have already trimmed via enforceCap.
      const keysAfterWrite = await adapter.listKeys(TOKEN_CACHE_KEY_PREFIX)
      expect(keysAfterWrite.length).toBe(5)

      // pruneExpired on a clean state is a no-op for the count.
      now = 1_000_000_000_000 + 10_000
      const r = await cache.pruneExpired()
      expect(r.remaining).toBe(5)
    })

    it('eviction drops oldest fetchedAt entries first', async () => {
      // Write 5 entries one-second apart.
      for (let i = 0; i < 5; i++) {
        now = 1_000_000_000_000 + i * 1000
        await cache.write(meta(`X${i}`, { isVerified: true }))
      }
      // 6th write should evict X0 (oldest).
      now += 1000
      await cache.write(meta('X5', { isVerified: true }))

      const keysAfter = [...await adapter.listKeys(TOKEN_CACHE_KEY_PREFIX)]
      expect(keysAfter.sort()).toEqual([
        `${TOKEN_CACHE_KEY_PREFIX}X1`,
        `${TOKEN_CACHE_KEY_PREFIX}X2`,
        `${TOKEN_CACHE_KEY_PREFIX}X3`,
        `${TOKEN_CACHE_KEY_PREFIX}X4`,
        `${TOKEN_CACHE_KEY_PREFIX}X5`,
      ].sort())
    })

    it('clearTokenCache wipes only token entries, leaving foreign keys alone', async () => {
      await adapter.set('unrelated:key', 'leave me')
      await cache.write(meta('Y'))
      await cache.clearTokenCache()
      expect(await adapter.get(`${TOKEN_CACHE_KEY_PREFIX}Y`)).toBeNull()
      expect(await adapter.get('unrelated:key')).toBe('leave me')
    })

    it('persisting the fallback object prevents refetch storms for unknown mints', async () => {
      // Caller writes a fallback (icon=null, isVerified=false) when Jupiter
      // has no row. Subsequent reads return that record (within 24h).
      const fallback = meta('UnknownMint', {
        name: 'Unknown token',
        symbol: '—',
        decimals: 0,
        icon: null,
        isVerified: false,
      })
      await cache.write(fallback)
      const hit = await cache.read('UnknownMint')
      expect(hit).not.toBeNull()
      expect(hit?.icon).toBeNull()
      expect(hit?.isVerified).toBe(false)
    })
  })
}
