import type { PriorityFeeSample, TransactionUrgency } from "@helio/types";

import { HelioSolanaError } from "../errors/helio-solana-error";

const URGENCY_PERCENTILE_MAP: Record<TransactionUrgency, number> = {
  low: 0.35,
  medium: 0.6,
  high: 0.85,
};

function clampIndex(index: number, size: number): number {
  return Math.max(0, Math.min(index, size - 1));
}

/**
 * Estimates an appropriate priority fee from recent fee observations.
 *
 * @param recentFees - Recent priority fee samples expressed in lamports.
 * @param urgency - Desired urgency tier for the transaction.
 * @returns Recommended priority fee in lamports.
 * @throws {HelioSolanaError} When no fee samples are available.
 */
export function estimatePriorityFeeLamports(
  recentFees: readonly PriorityFeeSample[],
  urgency: TransactionUrgency,
): number {
  if (recentFees.length === 0) {
    throw new HelioSolanaError(
      "No recent priority fee data is available.",
      "INSUFFICIENT_PRIORITY_FEE_DATA",
    );
  }

  const sortedFees = [...recentFees].sort(
    (left, right) => left.feeLamports - right.feeLamports,
  );
  const percentile = URGENCY_PERCENTILE_MAP[urgency];
  const targetIndex = clampIndex(
    Math.floor((sortedFees.length - 1) * percentile),
    sortedFees.length,
  );

  return sortedFees[targetIndex]?.feeLamports ?? 0;
}
