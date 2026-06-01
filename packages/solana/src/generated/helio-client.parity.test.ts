/**
 * Byte-for-byte parity tests for the Codama-generated `@solana/kit` Helio client
 * (ADR-0005 / ADR-0004 Phase 3) against the legacy `@coral-xyz/anchor` v1 client
 * it replaces. Anchor v1 + web3.js v1 are **test-only devDependencies** here — the
 * shipped package does not depend on them at runtime.
 *
 * The Anchor `Program.methods.<ix>(...).accountsStrict(...).instruction()` output is
 * the oracle: for every instruction the app actually calls, the Kit builder must
 * produce an identical `programAddress`, account metas (order + signer + writable),
 * and `data` bytes (8-byte discriminator + Borsh args). This proves the generated
 * builders are exact drop-ins before the live signing path is cut over.
 *
 * NOTE: this file lives OUTSIDE `src/generated/helio/` so `generate:client`'s
 * delete-before-render never clobbers it.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import {
  address,
  createNoopSigner,
  isSignerRole,
  isWritableRole,
} from "@solana/kit";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { beforeAll, describe, expect, it } from "vitest";

import { findAutoYieldProgramAddresses } from "../auto-yield/auto-yield-program";
import {
  CLOSE_EMPTY_RESERVE_DISCRIMINATOR,
  findConfigPda,
  findReserveAuthorityPda,
  findReserveStatePda,
  findSolVaultPda,
  findStableVaultPda,
  getInitializeAutoYieldInstruction,
  getPauseAutoYieldInstruction,
  getResumeAutoYieldInstruction,
  getSendSolInstruction,
  getSweepSolInstruction,
  getUpdateAutoYieldConfigInstruction,
  getUserAutoYieldConfigDecoder,
  getUserAutoYieldConfigEncoder,
  getWithdrawSolInstruction,
  getWithdrawVaultSolInstruction,
  HELIO_PROGRAM_ADDRESS,
  INITIALIZE_AUTO_YIELD_DISCRIMINATOR,
  PAUSE_AUTO_YIELD_DISCRIMINATOR,
  RESUME_AUTO_YIELD_DISCRIMINATOR,
  SEND_SOL_DISCRIMINATOR,
  SWEEP_SOL_DISCRIMINATOR,
  SWEEP_STABLE_DISCRIMINATOR,
  UPDATE_AUTO_YIELD_CONFIG_DISCRIMINATOR,
  WITHDRAW_SOL_DISCRIMINATOR,
  WITHDRAW_STABLE_DISCRIMINATOR,
  WITHDRAW_VAULT_SOL_DISCRIMINATOR,
} from "./helio";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROGRAM_ID = "EJw2Y8jJwbw1CeHRDRHSeUYzU2L1ke1aqmkQLod5T151";
const OWNER = "9fYLFVoVqwH37C3dyPi6cpeobfbQ2jtLpN5HgAYDDdkm";
const RECIPIENT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
// Token program (avoids an @solana/spl-token dep just for a constant).
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const SYSTEM_PROGRAM = "11111111111111111111111111111111";

const AMOUNT = 12_345_678; // u64 lamports — non-round to exercise LE encoding
const SWEEP_BPS = 137; // u16 — non-round to exercise 2-byte LE

// AutoYieldConfigArgs — same logical values, Kit (bigint) vs Anchor (BN) forms.
const CONFIG_ARGS_KIT = {
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
const CONFIG_ARGS_ANCHOR = {
  enabled: true,
  paused: false,
  sweepMode: 0,
  roundUpUnitLamports: new BN(10_000_000),
  percentageBps: 100,
  deployThresholdAtomic: new BN(1_000_000),
  activeProtocol: 0,
  allowedProtocolsMask: 1,
  excludedProtocolsMask: 0,
};

// The on-chain discriminators, copied from the IDL — and identical to the hardcoded
// `HELIO_DISCRIMINATORS` table in `src/lib/transaction-history.ts` (frozen here rather
// than cross-imported from the app tree, so this doubles as that table's golden).
const IDL_DISCRIMINATORS: Record<string, number[]> = {
  close_empty_reserve: [136, 48, 94, 98, 100, 148, 204, 7],
  initialize_auto_yield: [251, 132, 53, 164, 110, 171, 181, 23],
  pause_auto_yield: [211, 43, 244, 12, 113, 41, 221, 214],
  resume_auto_yield: [214, 119, 163, 153, 185, 215, 243, 65],
  send_sol: [214, 24, 219, 18, 3, 205, 201, 179],
  sweep_sol: [48, 81, 27, 227, 28, 145, 224, 204],
  sweep_stable: [74, 168, 179, 44, 42, 24, 113, 118],
  update_auto_yield_config: [36, 48, 204, 198, 62, 156, 39, 92],
  withdraw_sol: [145, 131, 74, 136, 65, 137, 42, 38],
  withdraw_stable: [91, 237, 76, 210, 121, 146, 161, 93],
  withdraw_vault_sol: [3, 23, 239, 50, 93, 233, 102, 85],
};

// ── Anchor v1 oracle ────────────────────────────────────────────────────────────

const idlPath = fileURLToPath(
  new URL("../../../../src/lib/idl/helio.json", import.meta.url),
);
const IDL = JSON.parse(readFileSync(idlPath, "utf8"));

// Anchor's TS client is intentionally dynamic when the IDL is not a `const` type
// (the shipped `src/lib/helio-program.ts` uses the same `as any` casts). These
// `any`s are confined to the test oracle and never reach shipped code.
// biome-ignore lint/suspicious/noExplicitAny: Anchor oracle uses an untyped IDL
function makeAnchorProgram(): any {
  const connection = new Connection("http://localhost:8899", "confirmed");
  const wallet = {
    publicKey: new PublicKey(OWNER),
    signTransaction: async (t: unknown) => t,
    signAllTransactions: async (t: unknown) => t,
  };
  // biome-ignore lint/suspicious/noExplicitAny: AnchorProvider wallet adapter shim
  const provider = new AnchorProvider(connection, wallet as any, {
    commitment: "confirmed",
  });
  // biome-ignore lint/suspicious/noExplicitAny: untyped IDL → dynamic Program
  return new Program(IDL as any, provider);
}

// ── Normalization for comparison ───────────────────────────────────────────────

interface NormalizedInstruction {
  programAddress: string;
  accounts: { address: string; isSigner: boolean; isWritable: boolean }[];
  data: number[];
}

function normalizeAnchor(ix: {
  programId: PublicKey;
  keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[];
  data: Buffer | Uint8Array;
}): NormalizedInstruction {
  return {
    programAddress: ix.programId.toBase58(),
    accounts: ix.keys.map((k) => ({
      address: k.pubkey.toBase58(),
      isSigner: k.isSigner,
      isWritable: k.isWritable,
    })),
    data: Array.from(ix.data),
  };
}

function normalizeKit(ix: {
  programAddress: string;
  accounts: readonly { address: string; role: number }[];
  data: Uint8Array;
}): NormalizedInstruction {
  return {
    programAddress: ix.programAddress,
    accounts: ix.accounts.map((a) => ({
      address: a.address,
      isSigner: isSignerRole(a.role),
      isWritable: isWritableRole(a.role),
    })),
    data: Array.from(ix.data),
  };
}

// PDAs shared by both builders (derived once via the Phase-2 golden-tested helper).
let pdas: Awaited<ReturnType<typeof findAutoYieldProgramAddresses>>;
let signer: ReturnType<typeof createNoopSigner>;
// biome-ignore lint/suspicious/noExplicitAny: dynamic Anchor Program (untyped IDL)
let program: any;

beforeAll(async () => {
  pdas = await findAutoYieldProgramAddresses(OWNER, USDC_MINT);
  signer = createNoopSigner(address(OWNER));
  program = makeAnchorProgram();
});

// ── Discriminator parity (all 11 instructions) ──────────────────────────────────

describe("discriminator parity (generated === IDL === transaction-history goldens)", () => {
  const cases: [string, Uint8Array][] = [
    ["close_empty_reserve", CLOSE_EMPTY_RESERVE_DISCRIMINATOR],
    ["initialize_auto_yield", INITIALIZE_AUTO_YIELD_DISCRIMINATOR],
    ["pause_auto_yield", PAUSE_AUTO_YIELD_DISCRIMINATOR],
    ["resume_auto_yield", RESUME_AUTO_YIELD_DISCRIMINATOR],
    ["send_sol", SEND_SOL_DISCRIMINATOR],
    ["sweep_sol", SWEEP_SOL_DISCRIMINATOR],
    ["sweep_stable", SWEEP_STABLE_DISCRIMINATOR],
    ["update_auto_yield_config", UPDATE_AUTO_YIELD_CONFIG_DISCRIMINATOR],
    ["withdraw_sol", WITHDRAW_SOL_DISCRIMINATOR],
    ["withdraw_stable", WITHDRAW_STABLE_DISCRIMINATOR],
    ["withdraw_vault_sol", WITHDRAW_VAULT_SOL_DISCRIMINATOR],
  ];

  for (const [name, generated] of cases) {
    it(`${name} matches the IDL discriminator`, () => {
      const fromIdl = IDL.instructions.find(
        (i: { name: string }) => i.name === name,
      )?.discriminator as number[];
      expect(Array.from(generated)).toEqual(IDL_DISCRIMINATORS[name]);
      expect(IDL_DISCRIMINATORS[name]).toEqual(fromIdl);
    });
  }

  it("HELIO_PROGRAM_ADDRESS matches the IDL program id", () => {
    expect(HELIO_PROGRAM_ADDRESS).toBe(PROGRAM_ID);
    expect(IDL.address).toBe(PROGRAM_ID);
  });
});

// ── Full instruction parity (the 8 instructions the app calls) ───────────────────

describe("instruction parity vs Anchor v1 (.accountsStrict().instruction())", () => {
  it("initialize_auto_yield", async () => {
    const kit = getInitializeAutoYieldInstruction({
      owner: signer,
      config: address(pdas.configAddress),
      reserveState: address(pdas.reserveStateAddress),
      solVault: address(pdas.solVaultAddress),
      reserveAuthority: address(pdas.reserveAuthorityAddress),
      stableVault: address(pdas.stableVaultAddress),
      stableMint: address(USDC_MINT),
      tokenProgram: address(TOKEN_PROGRAM),
      systemProgram: address(SYSTEM_PROGRAM),
      args: CONFIG_ARGS_KIT,
    });
    const anchor = await program.methods
      .initializeAutoYield(CONFIG_ARGS_ANCHOR)
      .accountsStrict({
        owner: new PublicKey(OWNER),
        config: new PublicKey(pdas.configAddress),
        reserveState: new PublicKey(pdas.reserveStateAddress),
        solVault: new PublicKey(pdas.solVaultAddress),
        reserveAuthority: new PublicKey(pdas.reserveAuthorityAddress),
        stableVault: new PublicKey(pdas.stableVaultAddress),
        stableMint: new PublicKey(USDC_MINT),
        tokenProgram: new PublicKey(TOKEN_PROGRAM),
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    expect(normalizeKit(kit)).toEqual(normalizeAnchor(anchor));
  });

  it("update_auto_yield_config", async () => {
    const kit = getUpdateAutoYieldConfigInstruction({
      owner: signer,
      config: address(pdas.configAddress),
      args: CONFIG_ARGS_KIT,
    });
    const anchor = await program.methods
      .updateAutoYieldConfig(CONFIG_ARGS_ANCHOR)
      .accountsStrict({
        owner: new PublicKey(OWNER),
        config: new PublicKey(pdas.configAddress),
      })
      .instruction();
    expect(normalizeKit(kit)).toEqual(normalizeAnchor(anchor));
  });

  it("pause_auto_yield", async () => {
    const kit = getPauseAutoYieldInstruction({
      owner: signer,
      config: address(pdas.configAddress),
    });
    const anchor = await program.methods
      .pauseAutoYield()
      .accountsStrict({
        owner: new PublicKey(OWNER),
        config: new PublicKey(pdas.configAddress),
      })
      .instruction();
    expect(normalizeKit(kit)).toEqual(normalizeAnchor(anchor));
  });

  it("resume_auto_yield", async () => {
    const kit = getResumeAutoYieldInstruction({
      owner: signer,
      config: address(pdas.configAddress),
    });
    const anchor = await program.methods
      .resumeAutoYield()
      .accountsStrict({
        owner: new PublicKey(OWNER),
        config: new PublicKey(pdas.configAddress),
      })
      .instruction();
    expect(normalizeKit(kit)).toEqual(normalizeAnchor(anchor));
  });

  it("send_sol", async () => {
    const kit = getSendSolInstruction({
      owner: signer,
      recipient: address(RECIPIENT),
      solVault: address(pdas.solVaultAddress),
      systemProgram: address(SYSTEM_PROGRAM),
      amountLamports: AMOUNT,
      sweepBps: SWEEP_BPS,
    });
    const anchor = await program.methods
      .sendSol(new BN(AMOUNT), SWEEP_BPS)
      .accountsStrict({
        owner: new PublicKey(OWNER),
        recipient: new PublicKey(RECIPIENT),
        solVault: new PublicKey(pdas.solVaultAddress),
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    expect(normalizeKit(kit)).toEqual(normalizeAnchor(anchor));
  });

  it("sweep_sol", async () => {
    const kit = getSweepSolInstruction({
      owner: signer,
      config: address(pdas.configAddress),
      reserveState: address(pdas.reserveStateAddress),
      solVault: address(pdas.solVaultAddress),
      systemProgram: address(SYSTEM_PROGRAM),
      amountLamports: AMOUNT,
    });
    const anchor = await program.methods
      .sweepSol(new BN(AMOUNT))
      .accountsStrict({
        owner: new PublicKey(OWNER),
        config: new PublicKey(pdas.configAddress),
        reserveState: new PublicKey(pdas.reserveStateAddress),
        solVault: new PublicKey(pdas.solVaultAddress),
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    expect(normalizeKit(kit)).toEqual(normalizeAnchor(anchor));
  });

  it("withdraw_vault_sol", async () => {
    const kit = getWithdrawVaultSolInstruction({
      owner: signer,
      solVault: address(pdas.solVaultAddress),
      amountLamports: AMOUNT,
    });
    const anchor = await program.methods
      .withdrawVaultSol(new BN(AMOUNT))
      .accountsStrict({
        owner: new PublicKey(OWNER),
        solVault: new PublicKey(pdas.solVaultAddress),
      })
      .instruction();
    expect(normalizeKit(kit)).toEqual(normalizeAnchor(anchor));
  });

  it("withdraw_sol", async () => {
    const kit = getWithdrawSolInstruction({
      owner: signer,
      config: address(pdas.configAddress),
      reserveState: address(pdas.reserveStateAddress),
      solVault: address(pdas.solVaultAddress),
      amountLamports: AMOUNT,
    });
    const anchor = await program.methods
      .withdrawSol(new BN(AMOUNT))
      .accountsStrict({
        owner: new PublicKey(OWNER),
        config: new PublicKey(pdas.configAddress),
        reserveState: new PublicKey(pdas.reserveStateAddress),
        solVault: new PublicKey(pdas.solVaultAddress),
      })
      .instruction();
    expect(normalizeKit(kit)).toEqual(normalizeAnchor(anchor));
  });
});

// ── PDA finder parity (generated finders === Phase-2 helper) ─────────────────────

describe("PDA finder parity with findAutoYieldProgramAddresses", () => {
  it("derives the same 5 PDAs", async () => {
    const owner = address(OWNER);
    const [config, reserveState, reserveAuthority, solVault, stableVault] =
      await Promise.all([
        findConfigPda({ owner }),
        findReserveStatePda({ owner }),
        findReserveAuthorityPda({ owner }),
        findSolVaultPda({ owner }),
        findStableVaultPda({ owner, stableMint: address(USDC_MINT) }),
      ]);
    expect({
      configAddress: config[0],
      reserveStateAddress: reserveState[0],
      reserveAuthorityAddress: reserveAuthority[0],
      solVaultAddress: solVault[0],
      stableVaultAddress: stableVault[0],
    }).toEqual(pdas);
  });
});

// ── Account decoder round-trip ───────────────────────────────────────────────────

describe("account codec round-trip", () => {
  it("UserAutoYieldConfig encode → decode is lossless", () => {
    const value = {
      owner: address(OWNER),
      preferredStableMint: address(USDC_MINT),
      enabled: true,
      paused: false,
      sweepMode: 1,
      activeProtocol: 0,
      roundUpUnitLamports: 10_000_000n,
      percentageBps: 250,
      deployThresholdAtomic: 5_000_000n,
      allowedProtocolsMask: 3,
      excludedProtocolsMask: 0,
    };
    const encoded = getUserAutoYieldConfigEncoder().encode(value);
    const decoded = getUserAutoYieldConfigDecoder().decode(encoded);
    // The decoder adds the 8-byte discriminator; compare the data fields.
    expect({
      owner: decoded.owner,
      preferredStableMint: decoded.preferredStableMint,
      enabled: decoded.enabled,
      paused: decoded.paused,
      sweepMode: decoded.sweepMode,
      activeProtocol: decoded.activeProtocol,
      roundUpUnitLamports: decoded.roundUpUnitLamports,
      percentageBps: decoded.percentageBps,
      deployThresholdAtomic: decoded.deployThresholdAtomic,
      allowedProtocolsMask: decoded.allowedProtocolsMask,
      excludedProtocolsMask: decoded.excludedProtocolsMask,
    }).toEqual(value);
    // The encoder auto-prepends the account's 8-byte discriminator.
    expect(Array.from(decoded.discriminator)).toEqual([
      164, 121, 203, 179, 1, 222, 208, 58,
    ]);
  });
});
