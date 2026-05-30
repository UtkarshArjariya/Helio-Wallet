/**
 * RPC guard — security hardening for outbound Solana RPC traffic.
 *
 * Two controls live here, both mandated by the project security rules
 * (CLAUDE.md §5, "Rate-limited + validated RPC wrapper"):
 *
 *  1. `validateRpcUrl` — a scheme allowlist. Only `https://` is accepted for
 *     remote hosts; plain `http://` is permitted *only* for loopback hosts
 *     (local validator / dev). This blocks `file:`, `ws:`, `javascript:`,
 *     and cleartext remote endpoints from ever reaching `new Connection()`.
 *
 *  2. `solanaFetchMiddleware` — a token-bucket rate limiter wired into the
 *     web3.js `Connection` via its `fetchMiddleware` hook, so *every* RPC
 *     call (getBalance, simulateTransaction, sendRawTransaction, …) is spaced
 *     out. This prevents request storms that get the wallet rate-limited or
 *     IP-banned by the upstream RPC (Helius free tier, QuikNode, etc.).
 */

/** A token bucket: bursts up to `capacity`, then steady `refillPerSecond`. */
export interface TokenBucket {
  /** Resolves once a token is available (and consumes it). */
  acquire(): Promise<void>
}

/**
 * Create a token-bucket rate limiter.
 *
 * @param capacity - Maximum burst size (tokens available when fully idle).
 * @param refillPerSecond - Steady-state tokens replenished per second.
 * @returns A {@link TokenBucket} whose `acquire()` paces callers.
 */
export function createTokenBucket(capacity: number, refillPerSecond: number): TokenBucket {
  let tokens = capacity
  let last = Date.now()
  const waiters: Array<() => void> = []
  let timer: ReturnType<typeof setTimeout> | null = null

  function refill(): void {
    const now = Date.now()
    tokens = Math.min(capacity, tokens + ((now - last) / 1000) * refillPerSecond)
    last = now
  }

  function pump(): void {
    refill()
    while (waiters.length > 0 && tokens >= 1) {
      tokens -= 1
      const resolve = waiters.shift()
      resolve?.()
    }
    if (waiters.length > 0 && timer === null) {
      // Time until the next whole token is available.
      const waitMs = Math.max(10, ((1 - tokens) / refillPerSecond) * 1000)
      timer = setTimeout(() => {
        timer = null
        pump()
      }, waitMs)
    }
  }

  return {
    acquire(): Promise<void> {
      return new Promise<void>((resolve) => {
        waiters.push(resolve)
        pump()
      })
    },
  }
}

/**
 * Shared limiter for the app's Solana RPC traffic. ~12 burst, 25 req/s steady.
 *
 * Exported so the web3.js v2 (`@solana/kit`) read leaf can be paced by the
 * **same** bucket as the v1 `Connection` (via `HelioRpcClientOptions.kitTransport`),
 * keeping a single rate-limit budget against the shared upstream RPC host rather
 * than letting the two SDK paths pace independently.
 */
export const rpcBucket = createTokenBucket(12, 25)

/**
 * web3.js `fetchMiddleware` that paces RPC requests through {@link rpcBucket}.
 *
 * The middleware is callback-style: it must eventually invoke the supplied
 * `fetch(info, init)` to let the request proceed. We delay that call until a
 * rate-limit token is free.
 */
export function solanaFetchMiddleware(
  info: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
  next: (info: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1]) => void,
): void {
  void rpcBucket.acquire().then(() => next(info, init))
}

// Cleartext http:// is permitted ONLY for these loopback hosts (local validator
// / dev). `0.0.0.0` is intentionally excluded — it means "all interfaces", not
// loopback. DNS names that resolve to localhost can't be checked client-side,
// so the rule stays fail-closed for anything not literally loopback.
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

/**
 * Validate (and normalize) a Solana RPC endpoint URL against a scheme allowlist.
 *
 * @param rawUrl - Candidate endpoint URL (from preferences, env, or a future
 *   custom-RPC field).
 * @returns The normalized URL string when it is allowed.
 * @throws {Error} When the URL is malformed, uses a non-HTTP(S) scheme, or is
 *   cleartext `http://` to a non-loopback host.
 */
export function validateRpcUrl(rawUrl: string): string {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('RPC endpoint is not a valid URL.')
  }

  const scheme = parsed.protocol.replace(/:$/, '').toLowerCase()
  if (scheme !== 'https' && scheme !== 'http') {
    throw new Error(`RPC endpoint scheme "${scheme}" is not allowed — use https://.`)
  }

  if (scheme === 'http' && !LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error('Cleartext http:// RPC endpoints are only allowed for localhost.')
  }

  return parsed.toString()
}

/** Like {@link validateRpcUrl} but returns `null` instead of throwing. */
export function isAllowedRpcUrl(rawUrl: string): boolean {
  try {
    validateRpcUrl(rawUrl)
    return true
  } catch {
    return false
  }
}
