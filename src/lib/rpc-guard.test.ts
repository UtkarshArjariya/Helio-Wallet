import { describe, expect, it } from 'vitest';
import {
  createTokenBucket,
  isAllowedRpcUrl,
  validateRpcUrl,
} from './rpc-guard';

describe('validateRpcUrl — scheme allowlist', () => {
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
    // 3 burst tokens should all resolve effectively instantly.
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('paces requests once the burst is exhausted', async () => {
    // capacity 1, refill 50/s → ~20ms per extra token.
    const bucket = createTokenBucket(1, 50);
    await bucket.acquire(); // consumes the only burst token
    const start = Date.now();
    await bucket.acquire(); // must wait for a refill
    expect(Date.now() - start).toBeGreaterThanOrEqual(8);
  });
});
