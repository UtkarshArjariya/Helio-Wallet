/**
 * Hardened Kit (web3.js v2) RPC transport.
 *
 * This is the v2 analogue of the app's `src/lib/rpc-guard.ts` `fetchMiddleware`
 * — except the two security mandates from CLAUDE.md §5 ("Rate-limited +
 * validated RPC wrapper") live **inside the {@link RpcTransport} itself**, so
 * any `Rpc` built on it is rate-limited and scheme-validated by construction:
 *
 *  1. {@link validateRpcUrl} — a scheme allowlist. Only `https://` is accepted
 *     for remote hosts; plain `http://` is permitted *only* for loopback hosts
 *     (local validator / dev). This blocks `file:`, `ws:`, `javascript:`, and
 *     cleartext remote endpoints from ever reaching the network.
 *  2. A token-bucket rate limiter — every JSON-RPC call awaits a token before
 *     the underlying transport is invoked, so request storms can't get the
 *     wallet rate-limited or IP-banned by the upstream RPC.
 *
 * The logic intentionally mirrors `src/lib/rpc-guard.ts`. It is duplicated here
 * (rather than imported) because that module lives in the extension app tree,
 * which this publishable `@helio/api` package must not depend on.
 */

import { createDefaultRpcTransport, type RpcTransport } from "@solana/kit";

/** A token bucket: bursts up to `capacity`, then settles to `refillPerSecond`. */
export interface TokenBucket {
  /** Resolves once a token is available (and consumes it). */
  acquire(): Promise<void>;
}

/**
 * Create a token-bucket rate limiter.
 *
 * @param capacity - Maximum burst size (tokens available when fully idle).
 * @param refillPerSecond - Steady-state tokens replenished per second.
 * @returns A {@link TokenBucket} whose `acquire()` paces callers.
 */
export function createTokenBucket(
  capacity: number,
  refillPerSecond: number,
): TokenBucket {
  let tokens = capacity;
  let last = Date.now();
  const waiters: Array<() => void> = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  function refill(): void {
    const now = Date.now();
    tokens = Math.min(
      capacity,
      tokens + ((now - last) / 1000) * refillPerSecond,
    );
    last = now;
  }

  function pump(): void {
    refill();
    while (waiters.length > 0 && tokens >= 1) {
      tokens -= 1;
      const resolve = waiters.shift();
      resolve?.();
    }
    if (waiters.length > 0 && timer === null) {
      // Time until the next whole token is available.
      const waitMs = Math.max(10, ((1 - tokens) / refillPerSecond) * 1000);
      timer = setTimeout(() => {
        timer = null;
        pump();
      }, waitMs);
    }
  }

  return {
    acquire(): Promise<void> {
      return new Promise<void>((resolve) => {
        waiters.push(resolve);
        pump();
      });
    },
  };
}

// Cleartext http:// is permitted ONLY for these loopback hosts (local validator
// / dev). `0.0.0.0` is intentionally excluded — it means "all interfaces", not
// loopback. DNS names that resolve to localhost can't be checked client-side,
// so the rule stays fail-closed for anything not literally loopback.
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Validate (and normalize) a Solana RPC endpoint URL against a scheme allowlist.
 *
 * @param rawUrl - Candidate endpoint URL (from preferences, env, or a custom-RPC field).
 * @returns The normalized URL string when it is allowed.
 * @throws {Error} When the URL is malformed, uses a non-HTTP(S) scheme, or is
 *   cleartext `http://` to a non-loopback host.
 */
export function validateRpcUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("RPC endpoint is not a valid URL.");
  }

  const scheme = parsed.protocol.replace(/:$/, "").toLowerCase();
  if (scheme !== "https" && scheme !== "http") {
    throw new Error(
      `RPC endpoint scheme "${scheme}" is not allowed — use https://.`,
    );
  }

  if (scheme === "http" && !LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(
      "Cleartext http:// RPC endpoints are only allowed for localhost.",
    );
  }

  return parsed.toString();
}

/**
 * Like {@link validateRpcUrl} but returns `false` instead of throwing.
 *
 * @param rawUrl - Candidate endpoint URL.
 * @returns `true` when the URL passes the scheme allowlist, otherwise `false`.
 */
export function isAllowedRpcUrl(rawUrl: string): boolean {
  try {
    validateRpcUrl(rawUrl);
    return true;
  } catch {
    return false;
  }
}

/** Shared limiter for all Kit RPC transports — ~12 burst, 25 req/s steady (mirrors `rpc-guard.ts`). */
const kitRpcBucket = createTokenBucket(12, 25);

/** Options for {@link createRateLimitedKitTransport}; the defaults are production-ready. */
export interface KitTransportOptions {
  /** Override the shared rate limiter (used by tests to make pacing observable). */
  readonly limiter?: TokenBucket;
  /**
   * Override how the underlying transport is built from a (validated) URL.
   * Defaults to Kit's {@link createDefaultRpcTransport}. Used by tests to inject
   * a mock transport without touching the network.
   */
  readonly transportFactory?: (url: string) => RpcTransport;
}

/**
 * Builds a hardened Kit {@link RpcTransport} that enforces the scheme allowlist
 * and paces every request through a token bucket.
 *
 * The URL is validated **eagerly** but failures are surfaced **fail-closed at
 * call time** (every request rejects with the validation error) rather than
 * throwing from this factory — so a single misconfigured endpoint never crashes
 * client construction, and `executeWithOrderedFailover` can simply move on to
 * the next endpoint.
 *
 * @param rawUrl - The RPC endpoint URL to wrap.
 * @param options - Optional limiter / transport-factory overrides (see {@link KitTransportOptions}).
 * @returns An {@link RpcTransport} suitable for `createSolanaRpcFromTransport`.
 */
export function createRateLimitedKitTransport(
  rawUrl: string,
  options: KitTransportOptions = {},
): RpcTransport {
  const limiter = options.limiter ?? kitRpcBucket;
  const transportFactory =
    options.transportFactory ??
    ((url: string) => createDefaultRpcTransport({ url }));

  let validatedUrl: string | null = null;
  let validationError: Error | null = null;
  try {
    validatedUrl = validateRpcUrl(rawUrl);
  } catch (cause) {
    validationError = cause instanceof Error ? cause : new Error(String(cause));
  }

  const inner = validatedUrl === null ? null : transportFactory(validatedUrl);

  // Generic function so the value structurally matches Kit's generic
  // `RpcTransport` call signature; the cast bridges the well-known limitation
  // that an async arrow can't be assigned to a generic call signature directly.
  async function rateLimitedKitTransport<TResponse>(
    config: Parameters<RpcTransport>[0],
  ): Promise<TResponse> {
    if (inner === null) {
      throw validationError ?? new Error("RPC endpoint is not allowed.");
    }
    await limiter.acquire();
    return inner<TResponse>(config);
  }

  return rateLimitedKitTransport as RpcTransport;
}
