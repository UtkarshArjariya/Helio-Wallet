import {
  type Address,
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
} from "@solana/kit";

/**
 * Helio's AutoYield Anchor program id. Path B (fresh devnet deploy, ADR-0004
 * Phase 4b): regenerated from the local program keypair via `anchor keys sync`;
 * must equal `declare_id!` in `anchor/programs/helio/src/lib.rs`, the `helio`
 * entries in `anchor/Anchor.toml`, the vendored IDL `address`
 * (`src/lib/idl/helio.json`), and `HELIO_PROGRAM_ID` in `src/lib/helio-program.ts`.
 * (The previous live program was `Bc5g2…NNg1u`; the fresh deploy supersedes it.)
 */
export const HELIO_AUTO_YIELD_PROGRAM_ID =
  "EJw2Y8jJwbw1CeHRDRHSeUYzU2L1ke1aqmkQLod5T151";

/**
 * The deterministic PDA set used by the Helio AutoYield reserve program. All
 * addresses are kept as base58 strings so the `@helio/types`/consumer contract
 * is unchanged across the web3.js v1 → Kit migration (a Kit {@link Address} is a
 * branded base58 string, so it is returned directly).
 */
export interface AutoYieldProgramAddresses {
  /** Per-owner reserve config PDA (`["config", owner]`). */
  readonly configAddress: string;
  /** Per-owner reserve state PDA (`["reserve", owner]`). */
  readonly reserveStateAddress: string;
  /** Per-owner reserve authority PDA — signs vault CPIs (`["authority", owner]`). */
  readonly reserveAuthorityAddress: string;
  /** Per-owner native SOL vault PDA (`["sol-vault", owner]`). */
  readonly solVaultAddress: string;
  /** Per-owner, per-mint stablecoin vault PDA (`["vault", owner, mint]`). */
  readonly stableVaultAddress: string;
}

/**
 * Derives the deterministic PDA set used by the Helio AutoYield reserve program.
 *
 * Migrated from `@solana/web3.js` v1 `PublicKey.findProgramAddressSync` to
 * `@solana/kit` `getProgramDerivedAddress` per ADR-0004 Phase 2. This is a pure,
 * RPC-free, key-material-free leaf, so it carries no custody risk. The seeds are
 * byte-for-byte identical to the v1 path: Kit encodes a `string` seed via
 * `TextEncoder` (UTF-8) — the same bytes as the old `textEncoder.encode(...)` —
 * and `getAddressEncoder().encode(address(x))` yields the same 32 bytes as the
 * old `new PublicKey(x).toBytes()`. The `auto-yield-program.test.ts` suite
 * asserts that parity against the v1 implementation directly.
 *
 * **Now async:** Kit derives PDAs with WebCrypto SHA-256, which is
 * asynchronous, so this function returns a `Promise` (v1's `…Sync` variant has
 * no Kit equivalent). The function has no in-repo callers today, so the
 * signature change is non-breaking; future callers must `await` it.
 *
 * @param ownerAddress - Wallet address that owns the reserve configuration.
 * @param stableMintAddress - Preferred stablecoin mint stored in the config.
 * @returns A promise resolving to the PDA addresses for config, reserve state,
 *   authority, SOL vault, and stable vault (all base58 strings).
 * @throws {Error} If `ownerAddress` or `stableMintAddress` is not a valid base58 address.
 */
export async function findAutoYieldProgramAddresses(
  ownerAddress: string,
  stableMintAddress: string,
): Promise<AutoYieldProgramAddresses> {
  const addressEncoder = getAddressEncoder();
  const programAddress = address(HELIO_AUTO_YIELD_PROGRAM_ID);
  // 32-byte public-key seeds — equivalent to v1 `PublicKey#toBytes()`.
  const ownerSeed = addressEncoder.encode(address(ownerAddress));
  const stableMintSeed = addressEncoder.encode(address(stableMintAddress));

  // Derive the five independent PDAs concurrently. String seeds ("config", …)
  // are UTF-8-encoded by Kit, matching both the v1 path and the on-chain
  // `b"…"` byte-string seed constants in `anchor/programs/helio`.
  const [
    [configAddress],
    [reserveStateAddress],
    [reserveAuthorityAddress],
    [solVaultAddress],
    [stableVaultAddress],
  ] = await Promise.all([
    getProgramDerivedAddress({ programAddress, seeds: ["config", ownerSeed] }),
    getProgramDerivedAddress({ programAddress, seeds: ["reserve", ownerSeed] }),
    getProgramDerivedAddress({
      programAddress,
      seeds: ["authority", ownerSeed],
    }),
    getProgramDerivedAddress({
      programAddress,
      seeds: ["sol-vault", ownerSeed],
    }),
    getProgramDerivedAddress({
      programAddress,
      seeds: ["vault", ownerSeed, stableMintSeed],
    }),
  ]);

  // A Kit `Address` is a branded base58 string, so it satisfies the `string`
  // contract directly — no `.toBase58()` conversion needed.
  return {
    configAddress,
    reserveStateAddress,
    reserveAuthorityAddress,
    solVaultAddress,
    stableVaultAddress,
  } satisfies Record<keyof AutoYieldProgramAddresses, Address>;
}
