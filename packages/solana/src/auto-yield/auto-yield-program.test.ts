/**
 * Byte-for-byte parity tests for the ADR-0004 Phase 2 migration of
 * {@link findAutoYieldProgramAddresses} from `@solana/web3.js` v1
 * (`PublicKey.findProgramAddressSync`) to `@solana/kit`
 * (`getProgramDerivedAddress`).
 *
 * The migrated function is the source of truth; `@solana/web3.js` is a
 * **test-only devDependency** here purely to reproduce the *old* v1 derivation
 * and assert the Kit output is identical. The package itself no longer depends
 * on web3.js at runtime.
 */

import { Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import {
  type AutoYieldProgramAddresses,
  findAutoYieldProgramAddresses,
  HELIO_AUTO_YIELD_PROGRAM_ID,
} from "./auto-yield-program";

/**
 * The pre-migration v1 implementation, copied verbatim from the old
 * `auto-yield-program.ts`. This is the byte-for-byte reference the Kit
 * implementation must reproduce.
 */
function deriveV1(
  ownerAddress: string,
  stableMintAddress: string,
): AutoYieldProgramAddresses {
  const textEncoder = new TextEncoder();
  const programId = new PublicKey(HELIO_AUTO_YIELD_PROGRAM_ID);
  const ownerPublicKey = new PublicKey(ownerAddress);
  const stableMintPublicKey = new PublicKey(stableMintAddress);
  const [configAddress] = PublicKey.findProgramAddressSync(
    [textEncoder.encode("config"), ownerPublicKey.toBytes()],
    programId,
  );
  const [reserveStateAddress] = PublicKey.findProgramAddressSync(
    [textEncoder.encode("reserve"), ownerPublicKey.toBytes()],
    programId,
  );
  const [reserveAuthorityAddress] = PublicKey.findProgramAddressSync(
    [textEncoder.encode("authority"), ownerPublicKey.toBytes()],
    programId,
  );
  const [solVaultAddress] = PublicKey.findProgramAddressSync(
    [textEncoder.encode("sol-vault"), ownerPublicKey.toBytes()],
    programId,
  );
  const [stableVaultAddress] = PublicKey.findProgramAddressSync(
    [
      textEncoder.encode("vault"),
      ownerPublicKey.toBytes(),
      stableMintPublicKey.toBytes(),
    ],
    programId,
  );

  return {
    configAddress: configAddress.toBase58(),
    reserveStateAddress: reserveStateAddress.toBase58(),
    reserveAuthorityAddress: reserveAuthorityAddress.toBase58(),
    solVaultAddress: solVaultAddress.toBase58(),
    stableVaultAddress: stableVaultAddress.toBase58(),
  };
}

// Fixed real-world vectors (well-known mainnet addresses). Derivation
// correctness is independent of whether these are owners/mints in practice.
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const WSOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUP_MINT = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
const SAMPLE_OWNER = "9fYLFVoVqwH37C3dyPi6cpeobfbQ2jtLpN5HgAYDDdkm";

const FIXED_VECTORS: ReadonlyArray<readonly [owner: string, mint: string]> = [
  [SYSTEM_PROGRAM, USDC_MINT],
  [WSOL_MINT, USDC_MINT],
  [SAMPLE_OWNER, USDC_MINT],
  [SAMPLE_OWNER, JUP_MINT],
  [USDC_MINT, WSOL_MINT],
];

// Frozen golden PDAs for (SAMPLE_OWNER, USDC_MINT), derived **independently**
// from the verified on-chain seed constants in
// `anchor/programs/helio/src/constants.rs` — CONFIG_SEED=b"config",
// RESERVE_SEED=b"reserve", AUTHORITY_SEED=b"authority",
// SOL_VAULT_SEED=b"sol-vault", STABLE_VAULT_SEED=b"vault" — under program id
// Bc5g2…NNg1u. This anchors the suite to on-chain truth: the v1-parity tests
// only prove "Kit == old v1", but a seed string that drifts from the on-chain
// `b"…"` constants in *both* the implementation and the in-test v1 reference
// would slip through. These constants would catch that (note the historical
// `vault` vs `stable-vault` confusion called out in build-context.md).
const GOLDEN: AutoYieldProgramAddresses = {
  configAddress: "CYjvxUmsWqq6WL6Rw2ne8ukhpTXn4Xi27Qz1kUUUZMj2",
  reserveStateAddress: "mSCPcAtEu48pUYyNRmB1TdVcbiVzZaDLeNkQkgtXw1j",
  reserveAuthorityAddress: "5qBGCSsB6C7JD2tU4nnc8ZPWvM48gN4No2mz1tzdF114",
  solVaultAddress: "FWqExfvKrW4PtJkNNv5wBagqqfWKWgvpyeyVZfUVh8VB",
  stableVaultAddress: "4YQfAz76e7hNyUZyz9E7ZvGpsqg6DPPjeSf2hVJvDz2x",
};

const PDA_KEYS = [
  "configAddress",
  "reserveStateAddress",
  "reserveAuthorityAddress",
  "solVaultAddress",
  "stableVaultAddress",
] as const satisfies ReadonlyArray<keyof AutoYieldProgramAddresses>;

describe("findAutoYieldProgramAddresses (Kit migration)", () => {
  it("exposes Helio's real on-chain program id", () => {
    expect(HELIO_AUTO_YIELD_PROGRAM_ID).toBe(
      "Bc5g2hU4NDah3yqvA1zxTeNJkU7zN7NLx7VFhpquNg1u",
    );
    // The id is itself a valid base58 ed25519 public key.
    expect(new PublicKey(HELIO_AUTO_YIELD_PROGRAM_ID).toBase58()).toBe(
      HELIO_AUTO_YIELD_PROGRAM_ID,
    );
  });

  describe("byte-for-byte parity with the v1 implementation", () => {
    for (const [owner, mint] of FIXED_VECTORS) {
      it(`matches v1 for owner=${owner.slice(0, 8)}… mint=${mint.slice(0, 8)}…`, async () => {
        const kit = await findAutoYieldProgramAddresses(owner, mint);
        const v1 = deriveV1(owner, mint);
        expect(kit).toEqual(v1);
      });
    }

    it("reproduces frozen golden PDAs anchored to the on-chain seed constants", async () => {
      const kit = await findAutoYieldProgramAddresses(SAMPLE_OWNER, USDC_MINT);
      expect(kit).toEqual(GOLDEN);
    });

    it("matches v1 across freshly generated keypairs (fuzz)", async () => {
      // 100 iterations: each PDA is on-curve ~50% of the time, so this reliably
      // exercises the non-canonical bump-skip path (bumps below 255), not just
      // the first-try canonical case.
      for (let i = 0; i < 100; i += 1) {
        const owner = Keypair.generate().publicKey.toBase58();
        const mint = Keypair.generate().publicKey.toBase58();
        const kit = await findAutoYieldProgramAddresses(owner, mint);
        expect(kit).toEqual(deriveV1(owner, mint));
      }
    });

    it("matches v1 at the raw-byte level (not just base58 strings)", async () => {
      const kit = await findAutoYieldProgramAddresses(SAMPLE_OWNER, USDC_MINT);
      const v1 = deriveV1(SAMPLE_OWNER, USDC_MINT);
      for (const key of PDA_KEYS) {
        expect(Array.from(new PublicKey(kit[key]).toBytes())).toEqual(
          Array.from(new PublicKey(v1[key]).toBytes()),
        );
      }
    });
  });

  describe("structural invariants", () => {
    it("returns five valid, distinct base58 addresses", async () => {
      const result = await findAutoYieldProgramAddresses(
        SAMPLE_OWNER,
        USDC_MINT,
      );
      const values = PDA_KEYS.map((key) => result[key]);
      for (const value of values) {
        // Round-trips through PublicKey → it is a valid 32-byte base58 address.
        expect(new PublicKey(value).toBase58()).toBe(value);
      }
      expect(new Set(values).size).toBe(values.length);
    });

    it("is deterministic for identical inputs", async () => {
      const a = await findAutoYieldProgramAddresses(SAMPLE_OWNER, USDC_MINT);
      const b = await findAutoYieldProgramAddresses(SAMPLE_OWNER, USDC_MINT);
      expect(a).toEqual(b);
    });

    it("varies the stable-vault PDA with the mint but keeps owner-only PDAs stable", async () => {
      const withUsdc = await findAutoYieldProgramAddresses(
        SAMPLE_OWNER,
        USDC_MINT,
      );
      const withJup = await findAutoYieldProgramAddresses(
        SAMPLE_OWNER,
        JUP_MINT,
      );

      // The stable vault is seeded by the mint → must differ.
      expect(withUsdc.stableVaultAddress).not.toBe(withJup.stableVaultAddress);

      // config/reserve/authority/sol-vault are seeded by the owner only →
      // must be invariant to the mint.
      expect(withUsdc.configAddress).toBe(withJup.configAddress);
      expect(withUsdc.reserveStateAddress).toBe(withJup.reserveStateAddress);
      expect(withUsdc.reserveAuthorityAddress).toBe(
        withJup.reserveAuthorityAddress,
      );
      expect(withUsdc.solVaultAddress).toBe(withJup.solVaultAddress);
    });

    it("varies all owner-seeded PDAs with the owner", async () => {
      const ownerA = await findAutoYieldProgramAddresses(
        SAMPLE_OWNER,
        USDC_MINT,
      );
      const ownerB = await findAutoYieldProgramAddresses(WSOL_MINT, USDC_MINT);
      for (const key of PDA_KEYS) {
        expect(ownerA[key]).not.toBe(ownerB[key]);
      }
    });
  });

  describe("input validation", () => {
    it("rejects an invalid owner address", async () => {
      await expect(
        findAutoYieldProgramAddresses("not-base58!!!", USDC_MINT),
      ).rejects.toThrow();
    });

    it("rejects an invalid stable-mint address", async () => {
      await expect(
        findAutoYieldProgramAddresses(SAMPLE_OWNER, "0OIl-invalid"),
      ).rejects.toThrow();
    });
  });
});
