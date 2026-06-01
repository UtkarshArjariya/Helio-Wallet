/**
 * Atomic-amount formatting helpers shared between the legacy (web3.js v1) RPC
 * client and the new Kit (web3.js v2) read leaf.
 *
 * Extracted into its own pure module so both `helio-rpc-client.ts` and
 * `kit-rpc.ts` can format token balances without importing one another (which
 * would create an import cycle).
 */

/** Strip a trailing fractional run of zeros — and any now-dangling `.` — from a decimal string. */
function trimTrailingZeros(value: string): string {
  return value.replace(/\.?0+$/, '');
}

/**
 * Formats an atomic (smallest-unit) token amount as a human-readable decimal string.
 *
 * @param amountAtomic - The amount in the token's smallest unit (e.g. lamports).
 * @param decimals - The number of decimal places the token uses.
 * @returns The amount rendered as a trimmed decimal string (no trailing zeros).
 */
export function formatAtomicAmount(
  amountAtomic: bigint,
  decimals: number,
): string {
  if (decimals === 0) {
    return amountAtomic.toString();
  }

  const paddedAmount = amountAtomic.toString().padStart(decimals + 1, '0');
  const wholePart = paddedAmount.slice(0, -decimals);
  const fractionalPart = paddedAmount.slice(-decimals);

  return trimTrailingZeros(`${wholePart}.${fractionalPart}`);
}
