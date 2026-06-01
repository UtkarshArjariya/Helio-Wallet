/**
 * Unit tests for the Kit signing pipeline (ADR-0005 Stage 1b). The RPC is mocked,
 * but the build → sign (real WebCrypto signer) → simulate → send → poll-confirm
 * wiring, the generated instruction builders, and Kit transaction assembly are all
 * exercised for real. Asserts the security-critical behaviors: fail-closed on a
 * program error AND on an RPC simulate failure, the priority-fee two-pass, and that
 * the secret-byte copy is zeroed after signing.
 */

import { Keypair } from '@solana/web3.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createHelioKitSigner,
  type KitAutoYieldConfigArgs,
} from './helio-kit-signer';
import type { HelioKitRpcReader } from './kit-rpc';

const RECIPIENT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
// All-zero (valid base58) blockhash — fine for compile + wire encoding under the mock.
const BLOCKHASH = '11111111111111111111111111111111';

const CONFIG_ARGS: KitAutoYieldConfigArgs = {
  enabled: true,
  paused: false,
  sweepMode: 0,
  roundUpUnitLamports: 10_000_000n,
  percentageBps: 100,
  deployThresholdAtomic: 1_000_000n,
  activeProtocol: 0,
  allowedProtocolsMask: 1,
  excludedProtocolsMask: 0,
};

type MockRpc = {
  [K in keyof HelioKitRpcReader]: ReturnType<typeof vi.fn>;
};

function mockRpc(overrides: Partial<MockRpc> = {}): {
  rpc: HelioKitRpcReader;
  mocks: MockRpc;
} {
  const mocks: MockRpc = {
    getBalanceLamports: vi.fn(),
    getLatestBlockhash: vi.fn(async () => ({
      blockhash: BLOCKHASH,
      lastValidBlockHeight: 1000n,
    })),
    getAccountInfo: vi.fn(),
    getParsedTokenAccountsByOwner: vi.fn(),
    simulateTransactionBase64: vi.fn(async () => ({
      err: null,
      logs: ['Program log: ok'],
      unitsConsumed: 5000n,
    })),
    sendTransactionBase64: vi.fn(
      async () => '5oVcqHk2cLwY9xY8rTn3PqaWZ2mF8gPzk6sV1bN3dE4t',
    ),
    getSignatureStatus: vi.fn(async () => ({
      confirmationStatus: 'confirmed' as const,
      err: null,
      slot: 1n,
    })),
    getStakeAccountsByStaker: vi.fn(async () => []),
    getVoteAccounts: vi.fn(async () => []),
    getCurrentEpoch: vi.fn(async () => 0n),
    getMinimumBalanceForRentExemption: vi.fn(async () => 2_282_880n),
    ...overrides,
  };
  return { rpc: mocks as unknown as HelioKitRpcReader, mocks };
}

// Fast confirmation polling in tests.
const FAST = { confirmPollAttempts: 5, confirmPollIntervalMs: 0 };

let secret: Uint8Array;

beforeEach(() => {
  secret = Keypair.generate().secretKey; // valid 64-byte ed25519 keypair
});

describe('createHelioKitSigner', () => {
  it('sweepSol: builds → simulates → sends → confirms, returning the signature', async () => {
    const { rpc, mocks } = mockRpc();
    const signer = createHelioKitSigner(rpc, FAST);

    const sig = await signer.sweepSol(secret, 1_000_000);

    expect(sig).toBe('5oVcqHk2cLwY9xY8rTn3PqaWZ2mF8gPzk6sV1bN3dE4t');
    expect(mocks.simulateTransactionBase64).toHaveBeenCalledTimes(1);
    // Sent a base64 wire string, skipping preflight (already simulated).
    expect(mocks.sendTransactionBase64).toHaveBeenCalledWith(
      expect.any(String),
      { skipPreflight: true },
    );
    expect(mocks.getSignatureStatus).toHaveBeenCalled();
  });

  it('fail-closed: a program error blocks the send', async () => {
    const { rpc, mocks } = mockRpc({
      simulateTransactionBase64: vi.fn(async () => ({
        err: { InstructionError: [0, { Custom: 6001n }] },
        logs: ['Program failed'],
        unitsConsumed: 10n,
      })),
    });
    const signer = createHelioKitSigner(rpc, FAST);

    await expect(signer.sweepSol(secret, 1_000_000)).rejects.toThrow(
      /Simulation blocked/,
    );
    expect(mocks.sendTransactionBase64).not.toHaveBeenCalled();
  });

  it('fail-closed: an RPC simulate failure blocks the send', async () => {
    const { rpc, mocks } = mockRpc({
      simulateTransactionBase64: vi.fn(async () => {
        throw new Error('network down');
      }),
    });
    const signer = createHelioKitSigner(rpc, FAST);

    await expect(signer.sweepSol(secret, 1_000_000)).rejects.toThrow(
      /Could not simulate/,
    );
    expect(mocks.sendTransactionBase64).not.toHaveBeenCalled();
  });

  it('sendSol with a priority fee re-simulates the budgeted tx before sending', async () => {
    const { rpc, mocks } = mockRpc();
    const signer = createHelioKitSigner(rpc, FAST);

    await signer.sendSol(secret, RECIPIENT, 500_000, 100, 1_000);

    // Pass 1 (sizing) + pass 2 (with compute budget) → two simulations, one send.
    expect(mocks.simulateTransactionBase64).toHaveBeenCalledTimes(2);
    expect(mocks.sendTransactionBase64).toHaveBeenCalledTimes(1);
    // The two simulated wires differ (the second prepends ComputeBudget ixs).
    const firstWire = mocks.simulateTransactionBase64.mock.calls[0][0];
    const secondWire = mocks.simulateTransactionBase64.mock.calls[1][0];
    expect(firstWire).not.toBe(secondWire);
  });

  it('sendSol without a priority fee simulates once', async () => {
    const { rpc, mocks } = mockRpc();
    const signer = createHelioKitSigner(rpc, FAST);

    await signer.sendSol(secret, RECIPIENT, 500_000, 100, 0);

    expect(mocks.simulateTransactionBase64).toHaveBeenCalledTimes(1);
  });

  it('sendSolPlain builds a System transfer and sends it', async () => {
    const { rpc, mocks } = mockRpc();
    const signer = createHelioKitSigner(rpc, FAST);

    const sig = await signer.sendSolPlain(secret, RECIPIENT, 250_000);

    expect(sig).toBe('5oVcqHk2cLwY9xY8rTn3PqaWZ2mF8gPzk6sV1bN3dE4t');
    expect(mocks.sendTransactionBase64).toHaveBeenCalledTimes(1);
  });

  it('initializeAutoYield resolves all 5 PDAs and sends', async () => {
    const { rpc, mocks } = mockRpc();
    const signer = createHelioKitSigner(rpc, FAST);

    await signer.initializeAutoYield(secret, USDC_MINT, CONFIG_ARGS);

    expect(mocks.sendTransactionBase64).toHaveBeenCalledTimes(1);
  });

  it('simulateSend does NOT sign or send (review path)', async () => {
    const { rpc, mocks } = mockRpc();
    const owner = Keypair.generate().publicKey.toBase58();
    const signer = createHelioKitSigner(rpc, FAST);

    const outcome = await signer.simulateSend(owner, RECIPIENT, 500_000, 100);

    expect(outcome.ok).toBe(true);
    expect(outcome.unitsConsumed).toBe(5000);
    expect(mocks.simulateTransactionBase64).toHaveBeenCalledTimes(1);
    expect(mocks.sendTransactionBase64).not.toHaveBeenCalled();
  });

  it('simulateSend reports a program error as not-ok', async () => {
    const { rpc } = mockRpc({
      simulateTransactionBase64: vi.fn(async () => ({
        err: { Custom: 6022n },
        logs: ['sweep bps out of range'],
        unitsConsumed: null,
      })),
    });
    const owner = Keypair.generate().publicKey.toBase58();
    const signer = createHelioKitSigner(rpc, FAST);

    const outcome = await signer.simulateSend(owner, RECIPIENT, 500_000, 100);
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toBeTruthy();
  });

  it('zeroes the secret-byte copy after signing (key hygiene)', async () => {
    const { rpc } = mockRpc();
    const signer = createHelioKitSigner(rpc, FAST);

    await signer.sweepSol(secret, 1_000_000);

    expect(secret.every((b) => b === 0)).toBe(true);
  });

  it('zeroes the secret even when simulation fail-closes', async () => {
    const { rpc } = mockRpc({
      simulateTransactionBase64: vi.fn(async () => ({
        err: { Custom: 6001n },
        logs: [],
        unitsConsumed: null,
      })),
    });
    const signer = createHelioKitSigner(rpc, FAST);

    await expect(signer.sweepSol(secret, 1_000_000)).rejects.toThrow();
    expect(secret.every((b) => b === 0)).toBe(true);
  });

  it('throws if the transaction never confirms within the poll budget', async () => {
    const { rpc } = mockRpc({
      getSignatureStatus: vi.fn(async () => null), // never seen
    });
    const signer = createHelioKitSigner(rpc, {
      confirmPollAttempts: 3,
      confirmPollIntervalMs: 0,
    });

    await expect(signer.sweepSol(secret, 1_000_000)).rejects.toThrow(
      /not confirmed in time/,
    );
  });

  it('throws if the confirmed transaction carries an on-chain error', async () => {
    const { rpc } = mockRpc({
      getSignatureStatus: vi.fn(async () => ({
        confirmationStatus: 'confirmed' as const,
        err: { InstructionError: [0, 'Custom'] },
        slot: 1n,
      })),
    });
    const signer = createHelioKitSigner(rpc, FAST);

    await expect(signer.sweepSol(secret, 1_000_000)).rejects.toThrow(
      /failed on-chain/,
    );
  });
});
