/**
 * Unit tests for the shipped WalletContext state container.
 *
 * Scope: the orchestration + fail-closed security contracts the context owns,
 * with every I/O boundary mocked (rpc-service singletons, helio-program,
 * secret-store, send-review, swap, staking) so no RPC, crypto, or chrome.* is
 * touched. We assert behavior, not implementation: locked-wallet gating, key
 * zeroing on a blocked swap, send routing (sweep vs plain), the sweep-reserve
 * math, optimistic vault merges, and the standalone lock/generate/import fns.
 *
 * (Per CLAUDE.md §2: implementation + review pass; the security-sensitive
 * assertions — fail-closed gating and key zeroing — are the focus.)
 */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WALLET_ADDRESS_KEY } from './RouterContext';

// ─── Mocked boundaries ──────────────────────────────────────────────────────

vi.mock('@helio/solana', () => ({
  createDefaultAutoYieldState: vi.fn(() => ({})),
}));

vi.mock('../lib/rpc-service', () => ({
  ACTIVE_CLUSTER_LABEL: 'Devnet',
  connection: {},
  swapConnection: {},
  kitRpc: {},
  rpcClient: {
    getWalletDashboardSnapshot: vi.fn(async () => ({
      tokenRows: [],
      portfolio: { totalUsdValue: 0 },
    })),
    getNetworkStatus: vi.fn(async () => ({
      endpointLabel: 'Devnet',
      isHealthy: true,
      averageLatencyMs: 12,
    })),
  },
  jupiterTokensClient: { getTokens: vi.fn(async () => new Map()) },
  tokenMetadataCache: {
    readMany: vi.fn(async () => new Map()),
    writeMany: vi.fn(async () => {}),
  },
  jupiterSwapClient: { getSwapTransaction: vi.fn() },
  kitSigner: {
    initializeAutoYield: vi.fn(async () => 'sig-init'),
    pauseAutoYield: vi.fn(async () => 'sig-pause'),
    resumeAutoYield: vi.fn(async () => 'sig-resume'),
    updateAutoYieldConfig: vi.fn(async () => 'sig-cfg'),
    sweepSol: vi.fn(async () => 'sig-sweep'),
    withdrawSol: vi.fn(async () => 'sig-wsol'),
    withdrawVaultSol: vi.fn(async () => 'sig-wvault'),
    sendSol: vi.fn(async () => 'sig-send'),
    sendSolPlain: vi.fn(async () => 'sig-plain'),
  },
  stakeSigner: {
    stakeAndDelegate: vi.fn(async () => 'sig-stake'),
    deactivateStake: vi.fn(async () => 'sig-deact'),
    withdrawStake: vi.fn(async () => 'sig-wstake'),
  },
}));

vi.mock('../lib/helio-program', () => ({
  fetchOnChainVaultState: vi.fn(async () => ({
    initialized: false,
    configPda: { toBase58: () => 'PDA111' },
    config: null,
    reserve: null,
  })),
  saveKeypairToSession: vi.fn(),
  loadSessionKeypair: vi.fn(() => null),
  clearSessionKeypair: vi.fn(),
  zeroKeypairSecret: vi.fn(),
  resolveStableMint: vi.fn(() => ({ toBase58: () => 'MintXYZ' })),
}));

vi.mock('../lib/secret-store', () => ({
  loadSecret: vi.fn(() => null),
  hasSecret: vi.fn(() => false),
}));

vi.mock('../lib/send-review', () => ({
  reviewNativeSolSend: vi.fn(async () => ({ status: 'ready' })),
  resolvePriorityFeeMicroLamportsPerCu: vi.fn(async () => 1_000),
}));

vi.mock('../lib/swap', () => ({
  deserializeSwapTransaction: vi.fn(() => ({ kind: 'vtx' })),
  simulateSwap: vi.fn(async () => ({ ok: true })),
  signSendSwap: vi.fn(async () => 'sig-swap'),
}));

vi.mock('../lib/staking', () => ({
  fetchStakeAccounts: vi.fn(async () => []),
  fetchValidators: vi.fn(async () => []),
}));

import { Keypair } from '@solana/web3.js';
import {
  clearSessionKeypair,
  loadSessionKeypair,
  saveKeypairToSession,
  zeroKeypairSecret,
} from '../lib/helio-program';
import { jupiterSwapClient, kitSigner } from '../lib/rpc-service';
import { loadSecret } from '../lib/secret-store';
import { reviewNativeSolSend } from '../lib/send-review';
import { signSendSwap, simulateSwap } from '../lib/swap';
// Imported AFTER the mocks above so they resolve to the mocked modules.
import {
  generateAndSaveWallet,
  importKeypairToSession,
  lockWallet,
  useWallet,
  WalletProvider,
} from './WalletContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <WalletProvider>{children}</WalletProvider>
);

/** Render the context. Default render starts with NO wallet address in
 *  localStorage so the dashboard-refresh effect early-returns (no interval, no
 *  background fetch) — keeping every test deterministic. */
function renderWallet() {
  return renderHook(() => useWallet(), { wrapper });
}

/** Mark the wallet "unlocked" by giving the mocked secret store a 64-byte key. */
function unlock() {
  vi.mocked(loadSecret).mockReturnValue(new Uint8Array(64));
}

/** A minimal stand-in for a session Keypair used by the swap path. */
function fakeKeypair() {
  return { publicKey: { toBase58: () => 'OWNER1111' } } as unknown as Keypair;
}

/** jsdom's opaque-origin Storage is non-functional here, so install a real
 *  in-memory Storage on the globals the context reads (matches the stub pattern
 *  in token-metadata-cache.test.ts). */
function makeMemoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      m.set(k, String(v));
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
    clear: () => {
      m.clear();
    },
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    get length() {
      return m.size;
    },
  } as unknown as Storage;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeMemoryStorage());
  vi.stubGlobal('sessionStorage', makeMemoryStorage());
  vi.clearAllMocks();
  // Re-apply default mock return values cleared by clearAllMocks.
  vi.mocked(loadSecret).mockReturnValue(null);
  vi.mocked(loadSessionKeypair).mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('WalletContext — address + identity', () => {
  it('exposes empty placeholders when no wallet is set', () => {
    const { result } = renderWallet();
    expect(result.current.address).toBe('');
    expect(result.current.shortAddress).toBe('—');
    expect(result.current.name).toBe('Main Wallet');
  });

  it('formats a long address as xxxx…yyyy and persists via setWalletAddress', async () => {
    const { result } = renderWallet();
    const addr = 'AbCdEfGhIjKlMnOpQrStUvWxYz123456789012345678';
    await act(async () => {
      result.current.setWalletAddress(addr, 'Trading');
    });
    expect(localStorage.getItem(WALLET_ADDRESS_KEY)).toBe(addr);
    expect(localStorage.getItem('helio:label')).toBe('Trading');
    expect(result.current.address).toBe(addr);
    expect(result.current.name).toBe('Trading');
    expect(result.current.shortAddress).toBe('AbCd…5678');
  });
});

describe('WalletContext — keypair presence + lock', () => {
  it('reports hasKeypair=false when the session keypair is absent', () => {
    vi.mocked(loadSessionKeypair).mockReturnValue(null);
    const { result } = renderWallet();
    expect(result.current.hasKeypair).toBe(false);
  });

  it('reports hasKeypair=true when a session keypair exists', () => {
    vi.mocked(loadSessionKeypair).mockReturnValue(fakeKeypair());
    const { result } = renderWallet();
    expect(result.current.hasKeypair).toBe(true);
  });

  it('lockWallet clears the session keypair', () => {
    lockWallet();
    expect(clearSessionKeypair).toHaveBeenCalledTimes(1);
  });
});

describe('WalletContext — optimistic vault updates', () => {
  it('updateVault merges a partial patch', async () => {
    const { result } = renderWallet();
    await act(async () => {
      result.current.updateVault({ balance: 5, isActive: true });
    });
    expect(result.current.vault.balance).toBe(5);
    expect(result.current.vault.isActive).toBe(true);
    // Unrelated fields keep their defaults.
    expect(result.current.vault.initialized).toBe(false);
  });

  it('updateVaultRule flips a single rule without disturbing the others', async () => {
    const { result } = renderWallet();
    await act(async () => {
      result.current.updateVaultRule('roundUpTransfers', true);
    });
    expect(result.current.vault.rules.roundUpTransfers).toBe(true);
    expect(result.current.vault.rules.percentageIncoming).toBe(false);
  });
});

describe('WalletContext — fail-closed send gating', () => {
  it('submitSend rejects when the wallet is locked (no secret)', async () => {
    vi.mocked(loadSecret).mockReturnValue(null);
    const { result } = renderWallet();
    await act(async () => {
      await expect(
        result.current.submitSend('Recipient', 1_000, null),
      ).rejects.toThrow(/Wallet locked/);
    });
    expect(kitSigner.sendSol).not.toHaveBeenCalled();
    expect(kitSigner.sendSolPlain).not.toHaveBeenCalled();
  });

  it('sendSolPlain (sweepBps null) routes to kitSigner.sendSolPlain', async () => {
    unlock();
    const { result } = renderWallet();
    let res: { signature: string; explorerUrl: string } | undefined;
    await act(async () => {
      res = await result.current.sendSolPlain('Recipient', 2_000);
    });
    expect(kitSigner.sendSolPlain).toHaveBeenCalledTimes(1);
    expect(kitSigner.sendSol).not.toHaveBeenCalled();
    expect(res?.signature).toBe('sig-plain');
    expect(res?.explorerUrl).toContain('sig-plain');
  });

  it('sendSolWithSweep (sweepBps set) routes to kitSigner.sendSol', async () => {
    unlock();
    const { result } = renderWallet();
    await act(async () => {
      await result.current.sendSolWithSweep('Recipient', 2_000, 100);
    });
    expect(kitSigner.sendSol).toHaveBeenCalledTimes(1);
    expect(kitSigner.sendSolPlain).not.toHaveBeenCalled();
  });
});

describe('WalletContext — executeSwap (mainnet) gating + zeroing', () => {
  it('rejects when the wallet is locked', async () => {
    vi.mocked(loadSessionKeypair).mockReturnValue(null);
    const { result } = renderWallet();
    await act(async () => {
      await expect(result.current.executeSwap({} as never)).rejects.toThrow(
        /Wallet locked/,
      );
    });
    expect(jupiterSwapClient.getSwapTransaction).not.toHaveBeenCalled();
  });

  it('zeros the keypair and throws when swap simulation is blocked', async () => {
    vi.mocked(loadSessionKeypair).mockReturnValue(fakeKeypair());
    vi.mocked(jupiterSwapClient.getSwapTransaction).mockResolvedValue({
      swapTransactionBase64: 'b64',
      lastValidBlockHeight: 100,
    } as never);
    vi.mocked(simulateSwap).mockResolvedValue({
      ok: false,
      reason: 'insufficient',
    } as never);
    const { result } = renderWallet();
    await act(async () => {
      await expect(result.current.executeSwap({} as never)).rejects.toThrow(
        /Swap simulation blocked/,
      );
    });
    expect(zeroKeypairSecret).toHaveBeenCalledTimes(1);
    expect(signSendSwap).not.toHaveBeenCalled();
  });

  it('returns a mainnet explorer URL on a successful swap', async () => {
    vi.mocked(loadSessionKeypair).mockReturnValue(fakeKeypair());
    vi.mocked(jupiterSwapClient.getSwapTransaction).mockResolvedValue({
      swapTransactionBase64: 'b64',
      lastValidBlockHeight: 100,
    } as never);
    vi.mocked(simulateSwap).mockResolvedValue({ ok: true } as never);
    const { result } = renderWallet();
    let res: { signature: string; explorerUrl: string } | undefined;
    await act(async () => {
      res = await result.current.executeSwap({} as never);
    });
    expect(signSendSwap).toHaveBeenCalledTimes(1);
    expect(res?.signature).toBe('sig-swap');
    expect(res?.explorerUrl).toBe('https://solscan.io/tx/sig-swap');
  });
});

describe('WalletContext — reviewSend', () => {
  it('throws when no wallet address is set', async () => {
    const { result } = renderWallet();
    await act(async () => {
      await expect(
        result.current.reviewSend('Recipient', 1_000, null),
      ).rejects.toThrow(/No wallet address/);
    });
  });

  it('reserves vault-creation rent + the swept fraction for an uninitialized vault', async () => {
    localStorage.setItem(WALLET_ADDRESS_KEY, 'Owner1111');
    const { result } = renderWallet();
    await act(async () => {
      // 1% sweep of 1_000_000 = 10_000; + 1_300_000 one-time PDA rent (uninitialized).
      await result.current.reviewSend('Recipient', 1_000_000, 100);
    });
    expect(reviewNativeSolSend).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(reviewNativeSolSend).mock.calls[0][0];
    expect(arg.extraReserveLamports).toBe(1_310_000);
    expect(arg.owner).toBe('Owner1111');
  });

  it('reserves nothing extra for a plain (no-sweep) send', async () => {
    localStorage.setItem(WALLET_ADDRESS_KEY, 'Owner1111');
    const { result } = renderWallet();
    await act(async () => {
      await result.current.reviewSend('Recipient', 1_000_000, null);
    });
    const arg = vi.mocked(reviewNativeSolSend).mock.calls[0][0];
    expect(arg.extraReserveLamports).toBe(0);
  });
});

describe('WalletContext — standalone wallet fns', () => {
  it('generateAndSaveWallet persists a fresh address + saves the keypair', () => {
    const address = generateAndSaveWallet('Main Wallet');
    expect(address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/); // base58 pubkey
    expect(localStorage.getItem(WALLET_ADDRESS_KEY)).toBe(address);
    expect(saveKeypairToSession).toHaveBeenCalledTimes(1);
  });

  it('importKeypairToSession persists the address + saves the keypair', () => {
    const kp = Keypair.generate();
    importKeypairToSession(kp);
    expect(localStorage.getItem(WALLET_ADDRESS_KEY)).toBe(
      kp.publicKey.toBase58(),
    );
    expect(saveKeypairToSession).toHaveBeenCalledTimes(1);
  });
});
