import { PublicKey } from "@solana/web3.js";

/**
 * Helio's real deployed AutoYield Anchor program id (devnet). Previously this
 * was the SPL token-swap *example* id (`Fg6Pa…Q7QZ`), which derived PDAs that
 * never matched the on-chain program — see `declare_id!` in
 * `anchor/programs/helio/src/lib.rs` and `HELIO_PROGRAM_ID` in
 * `src/lib/helio-program.ts`, both of which use this value.
 */
export const HELIO_AUTO_YIELD_PROGRAM_ID =
  "Bc5g2hU4NDah3yqvA1zxTeNJkU7zN7NLx7VFhpquNg1u";

/**
 * Derives the deterministic PDA set used by the Helio AutoYield reserve program.
 *
 * @param ownerAddress - Wallet address that owns the reserve configuration.
 * @param stableMintAddress - Preferred stablecoin mint stored in the config.
 * @returns PDA addresses for config, reserve state, authority, SOL vault, and stable vault.
 */
export function findAutoYieldProgramAddresses(
  ownerAddress: string,
  stableMintAddress: string,
) {
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
