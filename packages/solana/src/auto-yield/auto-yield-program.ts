import { PublicKey } from "@solana/web3.js";

export const HELIO_AUTO_YIELD_PROGRAM_ID =
  "Fg6PaFpoGXkYsidMpWxTWqkZqWQmBfG1N6BqUyPpQ7QZ";

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
