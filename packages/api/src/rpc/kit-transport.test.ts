import type { RpcEndpointConfig } from '@helio/types';
import type { RpcTransport } from '@solana/kit';
import { describe, expect, it, vi } from 'vitest';

import { createHelioKitRpc } from './kit-rpc';
import {
  createRateLimitedKitTransport,
  createTokenBucket,
  isAllowedRpcUrl,
  type TokenBucket,
  validateRpcUrl,
} from './kit-transport';

const REQUEST = {
  payload: { jsonrpc: '2.0', id: 1, method: 'getSlot', params: [] },
} as const;

describe('validateRpcUrl — scheme allowlist (Kit transport)', () => {
  it('accepts https endpoints', () => {
    expect(validateRpcUrl('https://api.mainnet-beta.solana.com')).toContain(
      'https://',
    );
    expect(isAllowedRpcUrl('https://rpc.helius.xyz/?api-key=x')).toBe(true);
  });

  it('accepts http only for loopback hosts', () => {
    expect(isAllowedRpcUrl('http://localhost:8899')).toBe(true);
    expect(isAllowedRpcUrl('http://127.0.0.1:8899')).toBe(true);
  });

  it('rejects cleartext http to remote hosts', () => {
    expect(isAllowedRpcUrl('http://evil.example.com')).toBe(false);
    expect(() =>
      validateRpcUrl('http://api.mainnet-beta.solana.com'),
    ).toThrow();
  });

  it('rejects non-http(s) schemes', () => {
    expect(isAllowedRpcUrl('ws://localhost:8900')).toBe(false);
    expect(isAllowedRpcUrl('file:///etc/passwd')).toBe(false);
    expect(isAllowedRpcUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(isAllowedRpcUrl('not a url')).toBe(false);
    expect(() => validateRpcUrl('')).toThrow();
  });
});

describe('createTokenBucket — rate limiter', () => {
  it('grants immediately while tokens remain in the burst capacity', async () => {
    const bucket = createTokenBucket(3, 1);
    const start = Date.now();
    await Promise.all([bucket.acquire(), bucket.acquire(), bucket.acquire()]);
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('paces requests once the burst is exhausted', async () => {
    // capacity 1, refill 50/s → ~20ms per extra token.
    const bucket = createTokenBucket(1, 50);
    await bucket.acquire();
    const start = Date.now();
    await bucket.acquire();
    expect(Date.now() - start).toBeGreaterThanOrEqual(8);
  });
});

describe('createRateLimitedKitTransport', () => {
  it('validates the URL scheme and forwards to the inner transport', async () => {
    const inner = vi.fn<RpcTransport>().mockResolvedValue('inner-result');
    const transport = createRateLimitedKitTransport(
      'https://api.devnet.solana.com',
      {
        transportFactory: () => inner,
      },
    );

    const result = await transport(REQUEST);

    expect(result).toBe('inner-result');
    expect(inner).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalledWith(REQUEST);
  });

  it('acquires a rate-limit token before invoking the inner transport', async () => {
    const events: string[] = [];
    const limiter: TokenBucket = {
      acquire: vi.fn(async () => {
        events.push('acquire');
      }),
    };
    const inner = vi.fn<RpcTransport>(async () => {
      events.push('inner');
      return 'ok';
    });

    const transport = createRateLimitedKitTransport(
      'https://api.devnet.solana.com',
      {
        limiter,
        transportFactory: () => inner,
      },
    );

    await transport(REQUEST);

    expect(events).toEqual(['acquire', 'inner']);
    expect(limiter.acquire).toHaveBeenCalledTimes(1);
  });

  it('is fail-closed for a disallowed scheme — every request rejects, no inner transport is built', async () => {
    const transportFactory = vi.fn<(url: string) => RpcTransport>();
    const transport = createRateLimitedKitTransport(
      'ws://api.devnet.solana.com',
      {
        transportFactory,
      },
    );

    await expect(transport(REQUEST)).rejects.toThrow(/not allowed|use https/i);
    // A bad scheme must never reach the network layer.
    expect(transportFactory).not.toHaveBeenCalled();
  });

  it('does not throw at construction for a bad URL (defers failure to call time)', () => {
    expect(() =>
      createRateLimitedKitTransport('http://evil.example.com', {
        transportFactory: vi.fn<(url: string) => RpcTransport>(),
      }),
    ).not.toThrow();
  });

  it('truly gates the inner transport on the limiter (inner is not invoked until acquire resolves)', async () => {
    let releaseAcquire: () => void = () => {};
    const acquireGate = new Promise<void>((resolve) => {
      releaseAcquire = resolve;
    });
    const limiter: TokenBucket = { acquire: () => acquireGate };
    const inner = vi.fn<RpcTransport>().mockResolvedValue('ok');
    const transport = createRateLimitedKitTransport(
      'https://api.devnet.solana.com',
      {
        limiter,
        transportFactory: () => inner,
      },
    );

    const pending = transport(REQUEST);
    // Flush microtasks: the limiter has NOT resolved, so the inner transport
    // must not have been reached yet.
    await Promise.resolve();
    expect(inner).not.toHaveBeenCalled();

    releaseAcquire();
    await pending;
    expect(inner).toHaveBeenCalledTimes(1);
  });
});

describe('createHelioKitRpc — guard is wired into the production reader', () => {
  it('is fail-closed end-to-end: a disallowed-scheme endpoint makes reads reject', async () => {
    const endpoint: RpcEndpointConfig = {
      label: 'Bad scheme',
      network: 'devnet',
      url: 'ws://api.devnet.solana.com',
    };
    // No transportFactory override → exercises the real wiring; a valid address
    // passes input validation, so the rejection can only come from the guard.
    const reader = createHelioKitRpc(endpoint);

    await expect(
      reader.getBalanceLamports('11111111111111111111111111111111'),
    ).rejects.toThrow(/not allowed|use https/i);
  });
});
