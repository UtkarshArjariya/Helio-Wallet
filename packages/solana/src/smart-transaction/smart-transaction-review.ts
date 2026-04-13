import type {
  NetworkFeeBreakdown,
  SendAmountQuote,
  SmartAdjustmentReason,
  SmartTransactionAnalysisInput,
  SmartTransactionReview,
} from "@helio/types";

import { HelioSolanaError } from "../errors/helio-solana-error";
import { estimatePriorityFeeLamports } from "./priority-fee";

function parseAtomicAmount(amountAtomic: string): bigint {
  if (/^\d+$/.test(amountAtomic)) {
    const parsed = BigInt(amountAtomic);

    if (parsed > 0n) {
      return parsed;
    }
  }

  throw new HelioSolanaError(
    "Send amount must be a whole-number atomic value.",
    "INVALID_AMOUNT",
    {
      amountAtomic,
    },
  );
}

function trimTrailingZeros(value: string): string {
  return value.replace(/\.?0+$/, "");
}

function formatAtomicAmount(amountAtomic: bigint, decimals: number): string {
  if (decimals === 0) {
    return amountAtomic.toString();
  }

  const padded = amountAtomic.toString().padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals);

  return trimTrailingZeros(`${whole}.${fraction}`);
}

function toUsdEquivalent(
  amountAtomic: bigint,
  decimals: number,
  usdPrice: number | null,
): number | null {
  if (usdPrice === null) {
    return null;
  }

  return (Number(amountAtomic) / 10 ** decimals) * usdPrice;
}

function createAmountQuote(
  input: SmartTransactionAnalysisInput,
  amountAtomic: bigint,
): SendAmountQuote {
  return {
    amountAtomic: amountAtomic.toString(),
    amountDisplay: `${formatAtomicAmount(amountAtomic, input.asset.decimals)} ${input.asset.symbol}`,
    usdEquivalent: toUsdEquivalent(
      amountAtomic,
      input.asset.decimals,
      input.asset.usdPrice,
    ),
  };
}

function createFeeBreakdown(
  input: SmartTransactionAnalysisInput,
  priorityFeeLamports: number,
): NetworkFeeBreakdown {
  const totalLamports =
    input.estimatedNetworkFeeLamports +
    priorityFeeLamports +
    input.associatedTokenAccountRentLamports +
    input.rentExemptionReserveLamports;

  return {
    networkFeeLamports: input.estimatedNetworkFeeLamports,
    priorityFeeLamports: priorityFeeLamports,
    associatedTokenAccountRentLamports:
      input.associatedTokenAccountRentLamports,
    rentExemptionReserveLamports: input.rentExemptionReserveLamports,
    totalLamports,
  };
}

function createReason(
  code: SmartAdjustmentReason["code"],
  title: string,
  message: string,
  amountLamports: number,
  severity: SmartAdjustmentReason["severity"],
): SmartAdjustmentReason {
  return {
    code,
    title,
    message,
    amountLamports,
    severity,
  };
}

function createBaselineReasons(
  input: SmartTransactionAnalysisInput,
  feeBreakdown: NetworkFeeBreakdown,
): SmartAdjustmentReason[] {
  const reasons: SmartAdjustmentReason[] = [];

  if (
    input.requiresAssociatedTokenAccount &&
    feeBreakdown.associatedTokenAccountRentLamports > 0
  ) {
    reasons.push(
      createReason(
        "associated-token-account",
        "Recipient account creation required",
        "Helio must fund the recipient token account before the transfer can complete.",
        feeBreakdown.associatedTokenAccountRentLamports,
        "warning",
      ),
    );
  }

  if (input.wouldLikelyFailFromSlippage) {
    reasons.push(
      createReason(
        "slippage-warning",
        "Slippage risk detected",
        input.slippageWarningMessage ??
          "The current route is likely to fail due to slippage.",
        0,
        "critical",
      ),
    );
  }

  if (input.simulationWarning !== null) {
    reasons.push(
      createReason(
        "simulation-warning",
        "Simulation warning",
        input.simulationWarning,
        0,
        "warning",
      ),
    );
  }

  return reasons;
}

function createInsufficientSolReason(
  shortfallLamports: number,
): SmartAdjustmentReason {
  return createReason(
    "insufficient-sol-for-fees",
    "More SOL is required",
    "This wallet does not have enough SOL to cover fees and rent for the transaction.",
    shortfallLamports,
    "critical",
  );
}

function createNativeSolAdjustmentReason(
  deltaLamports: number,
): SmartAdjustmentReason {
  return createReason(
    "rent-exemption",
    "Rent reserve protected",
    "Helio reduced the SOL send amount to preserve rent exemption and execution fees.",
    deltaLamports,
    "warning",
  );
}

function appendPriorityFeeReason(
  reasons: SmartAdjustmentReason[],
  priorityFeeLamports: number,
): void {
  if (priorityFeeLamports <= 0) {
    return;
  }

  reasons.push(
    createReason(
      "priority-fee",
      "Priority fee applied",
      "A priority fee was added to improve confirmation speed under current network conditions.",
      priorityFeeLamports,
      "info",
    ),
  );
}

function buildBlockedReview(
  input: SmartTransactionAnalysisInput,
  requestedAmountAtomic: bigint,
  feeBreakdown: NetworkFeeBreakdown,
  reasons: readonly SmartAdjustmentReason[],
): SmartTransactionReview {
  const amountQuote = createAmountQuote(input, requestedAmountAtomic);

  return {
    status: "blocked",
    originalAmount: amountQuote,
    adjustedAmount: amountQuote,
    feeBreakdown,
    reasons,
    simulationWarning: input.simulationWarning,
    canSendOriginalAmount: false,
  };
}

/**
 * Produces a deterministic review model for Helio's smart transaction adjustment flow.
 *
 * @param input - Transaction context collected before the confirmation screen renders.
 * @returns Review state describing fees, warnings, and any adjusted amount.
 */
export function analyzeSmartTransactionReview(
  input: SmartTransactionAnalysisInput,
): SmartTransactionReview {
  const requestedAmountAtomic = parseAtomicAmount(
    input.requestedAmount.amountAtomic,
  );
  const priorityFeeLamports = estimatePriorityFeeLamports(
    input.recentPriorityFeeSamples,
    input.urgency,
  );
  const feeBreakdown = createFeeBreakdown(input, priorityFeeLamports);
  const reasons = createBaselineReasons(input, feeBreakdown);

  if (input.asset.kind === "spl-token") {
    const hasBlockingReason = reasons.some(
      (reason) =>
        reason.code === "simulation-warning" ||
        reason.code === "slippage-warning",
    );
    const hasNonPriorityAdjustmentReason = reasons.some(
      (reason) =>
        reason.code !== "priority-fee" &&
        reason.code !== "simulation-warning" &&
        reason.code !== "slippage-warning",
    );
    const requiredSolLamports =
      input.estimatedNetworkFeeLamports +
      priorityFeeLamports +
      input.associatedTokenAccountRentLamports;

    if (input.senderSolBalanceLamports < requiredSolLamports) {
      reasons.push(
        createInsufficientSolReason(
          requiredSolLamports - input.senderSolBalanceLamports,
        ),
      );
      return buildBlockedReview(
        input,
        requestedAmountAtomic,
        feeBreakdown,
        reasons,
      );
    }

    appendPriorityFeeReason(reasons, priorityFeeLamports);

    if (hasBlockingReason) {
      return buildBlockedReview(
        input,
        requestedAmountAtomic,
        feeBreakdown,
        reasons,
      );
    }

    return {
      status: hasNonPriorityAdjustmentReason ? "adjusted" : "ready",
      originalAmount: createAmountQuote(input, requestedAmountAtomic),
      adjustedAmount: createAmountQuote(input, requestedAmountAtomic),
      feeBreakdown,
      reasons,
      simulationWarning: input.simulationWarning,
      canSendOriginalAmount: false,
    };
  }

  const availableLamportsForSend = BigInt(
    Math.max(input.senderSolBalanceLamports - feeBreakdown.totalLamports, 0),
  );

  if (availableLamportsForSend === 0n) {
    reasons.push(
      createInsufficientSolReason(
        feeBreakdown.totalLamports - input.senderSolBalanceLamports,
      ),
    );
    return buildBlockedReview(
      input,
      requestedAmountAtomic,
      feeBreakdown,
      reasons,
    );
  }

  if (
    reasons.some(
      (reason) =>
        reason.code === "slippage-warning" ||
        reason.code === "simulation-warning",
    )
  ) {
    appendPriorityFeeReason(reasons, priorityFeeLamports);
    return buildBlockedReview(
      input,
      requestedAmountAtomic,
      feeBreakdown,
      reasons,
    );
  }

  const adjustedAmountAtomic =
    requestedAmountAtomic > availableLamportsForSend
      ? availableLamportsForSend
      : requestedAmountAtomic;

  if (adjustedAmountAtomic !== requestedAmountAtomic) {
    reasons.push(
      createNativeSolAdjustmentReason(
        Number(requestedAmountAtomic - adjustedAmountAtomic),
      ),
    );
  }

  appendPriorityFeeReason(reasons, priorityFeeLamports);

  return {
    status:
      adjustedAmountAtomic === requestedAmountAtomic ? "ready" : "adjusted",
    originalAmount: createAmountQuote(input, requestedAmountAtomic),
    adjustedAmount: createAmountQuote(input, adjustedAmountAtomic),
    feeBreakdown,
    reasons,
    simulationWarning: input.simulationWarning,
    canSendOriginalAmount: adjustedAmountAtomic !== requestedAmountAtomic,
  };
}
