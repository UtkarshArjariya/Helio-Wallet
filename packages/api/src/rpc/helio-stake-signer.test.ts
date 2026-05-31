/**
 * Unit tests for the native-staking Kit signer (ADR-0004 Phase 4). The RPC is
 * mocked, but the build → sign (real WebCrypto signers — owner + ephemeral stake
 * account) → simulate → send → poll-confirm wiring, the `@solana-program/stake` +
 * `@solana-program/system` instruction builders, and Kit transaction assembly are
 * all exercised for real. Asserts the §5 behaviors shared with the vault signer:
 * fail-closed on a program error AND on an RPC simulate failure, and that the
 * secret-byte copy is zeroed after signing.
 */

import { Keypair } from "@solana/web3.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createHelioStakeSigner } from "./helio-stake-signer";
import type { HelioKitRpcReader } from "./kit-rpc";

// Valid base58 addresses (the signer runs `address()` on these).
const VOTE = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const STAKE_ACCOUNT = "So11111111111111111111111111111111111111112";
const BLOCKHASH = "11111111111111111111111111111111";

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
      logs: ["Program log: ok"],
      unitsConsumed: 5000n,
    })),
    sendTransactionBase64: vi.fn(
      async () => "5oVcqHk2cLwY9xY8rTn3PqaWZ2mF8gPzk6sV1bN3dE4t",
    ),
    getSignatureStatus: vi.fn(async () => ({
      confirmationStatus: "confirmed" as const,
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

const FAST = { confirmPollAttempts: 5, confirmPollIntervalMs: 0 };

let secret: Uint8Array;

beforeEach(() => {
  secret = Keypair.generate().secretKey; // valid 64-byte ed25519 keypair
});

describe("createHelioStakeSigner", () => {
  it("stakeAndDelegate: fetches rent, simulates, sends, confirms, returns the signature", async () => {
    const { rpc, mocks } = mockRpc();
    const signer = createHelioStakeSigner(rpc, FAST);

    const sig = await signer.stakeAndDelegate(secret, 1_000_000_000, VOTE);

    expect(sig).toBe("5oVcqHk2cLwY9xY8rTn3PqaWZ2mF8gPzk6sV1bN3dE4t");
    // Rent reserve sized for a 200-byte StakeStateV2 account.
    expect(mocks.getMinimumBalanceForRentExemption).toHaveBeenCalledWith(200n);
    // No priority fee on the staking path → simulate exactly once.
    expect(mocks.simulateTransactionBase64).toHaveBeenCalledTimes(1);
    expect(mocks.sendTransactionBase64).toHaveBeenCalledWith(
      expect.any(String),
      { skipPreflight: true },
    );
    expect(mocks.getSignatureStatus).toHaveBeenCalled();
  });

  it("stakeAndDelegate: fail-closed when simulation reports a program error", async () => {
    const { rpc, mocks } = mockRpc({
      simulateTransactionBase64: vi.fn(async () => ({
        err: { InstructionError: [0, { Custom: 6n }] },
        logs: ["Program failed"],
        unitsConsumed: 10n,
      })),
    });
    const signer = createHelioStakeSigner(rpc, FAST);

    await expect(
      signer.stakeAndDelegate(secret, 1_000_000_000, VOTE),
    ).rejects.toThrow(/Simulation blocked/);
    expect(mocks.sendTransactionBase64).not.toHaveBeenCalled();
  });

  it("stakeAndDelegate: fail-closed when the RPC cannot simulate", async () => {
    const { rpc, mocks } = mockRpc({
      simulateTransactionBase64: vi.fn(async () => {
        throw new Error("network down");
      }),
    });
    const signer = createHelioStakeSigner(rpc, FAST);

    await expect(
      signer.stakeAndDelegate(secret, 1_000_000_000, VOTE),
    ).rejects.toThrow(/Could not simulate/);
    expect(mocks.sendTransactionBase64).not.toHaveBeenCalled();
  });

  it("stakeAndDelegate: zeroes the secret-byte copy after signing", async () => {
    const { rpc } = mockRpc();
    const signer = createHelioStakeSigner(rpc, FAST);

    await signer.stakeAndDelegate(secret, 1_000_000_000, VOTE);

    expect(secret.every((b) => b === 0)).toBe(true);
  });

  it("deactivateStake: builds → simulates → sends → confirms", async () => {
    const { rpc, mocks } = mockRpc();
    const signer = createHelioStakeSigner(rpc, FAST);

    const sig = await signer.deactivateStake(secret, STAKE_ACCOUNT);

    expect(sig).toBe("5oVcqHk2cLwY9xY8rTn3PqaWZ2mF8gPzk6sV1bN3dE4t");
    expect(mocks.sendTransactionBase64).toHaveBeenCalledTimes(1);
    // Deactivate needs no rent reserve.
    expect(mocks.getMinimumBalanceForRentExemption).not.toHaveBeenCalled();
  });

  it("withdrawStake: sends and zeroes the secret", async () => {
    const { rpc, mocks } = mockRpc();
    const signer = createHelioStakeSigner(rpc, FAST);

    const sig = await signer.withdrawStake(secret, STAKE_ACCOUNT, 500_000);

    expect(sig).toBe("5oVcqHk2cLwY9xY8rTn3PqaWZ2mF8gPzk6sV1bN3dE4t");
    expect(mocks.sendTransactionBase64).toHaveBeenCalledTimes(1);
    expect(secret.every((b) => b === 0)).toBe(true);
  });

  it("deactivateStake: fail-closed on a program error blocks the send", async () => {
    const { rpc, mocks } = mockRpc({
      simulateTransactionBase64: vi.fn(async () => ({
        err: { Custom: 7n },
        logs: [],
        unitsConsumed: null,
      })),
    });
    const signer = createHelioStakeSigner(rpc, FAST);

    await expect(
      signer.deactivateStake(secret, STAKE_ACCOUNT),
    ).rejects.toThrow(/Simulation blocked/);
    expect(mocks.sendTransactionBase64).not.toHaveBeenCalled();
  });
});
