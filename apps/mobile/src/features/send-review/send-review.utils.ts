import { analyzeSmartTransactionReview } from "@helio/solana";
import type { SendReviewModel, SmartAdjustmentReason } from "@helio/types";

import type {
  SendReviewDraft,
  SendReviewSection,
  SendReviewWarning,
} from "@/features/send-review/send-review.types";

/**
 * Formats SOL values with fixed precision.
 */
export function formatSol(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("SOL value must be a non-negative finite number.");
  }
  return `${value.toFixed(6)} SOL`;
}

/**
 * Ensures send-review draft includes minimum safe values.
 */
export function validateSendReviewDraft(draft: SendReviewDraft): void {
  if (!draft.reviewModel.recipient.address.trim()) {
    throw new Error("Recipient address is required before send review.");
  }
  const adjustedAmount = draft.reviewModel.review.adjustedAmount.amountAtomic;
  const originalAmount = draft.reviewModel.review.originalAmount.amountAtomic;

  if (!/^\d+$/.test(adjustedAmount) || BigInt(adjustedAmount) <= 0n) {
    throw new Error("Adjusted send amount must be a whole atomic amount.");
  }
  if (!/^\d+$/.test(originalAmount) || BigInt(originalAmount) <= 0n) {
    throw new Error("Send amount must be greater than zero.");
  }
}

/**
 * Returns user-facing sections for send-review surface.
 */
export function buildSendReviewSections(
  draft: SendReviewDraft,
): readonly SendReviewSection[] {
  validateSendReviewDraft(draft);
  const { reviewModel } = draft;
  const { review } = reviewModel;

  return [
    {
      title: "Transfer",
      items: [
        { label: "Recipient", value: reviewModel.recipient.shortAddress },
        { label: "Asset", value: review.adjustedAmount.amountDisplay },
        {
          label: "Est. value",
          value:
            review.adjustedAmount.usdEquivalent === null
              ? "Unavailable"
              : `$${review.adjustedAmount.usdEquivalent.toFixed(2)}`,
        },
      ],
    },
    {
      title: "Fees",
      items: [
        {
          label: "Network",
          value: formatSol(
            review.feeBreakdown.networkFeeLamports / 1_000_000_000,
          ),
        },
        {
          label: "Priority",
          value: formatSol(
            review.feeBreakdown.priorityFeeLamports / 1_000_000_000,
          ),
        },
        {
          label: "Token account setup",
          value: formatSol(
            review.feeBreakdown.associatedTokenAccountRentLamports /
              1_000_000_000,
          ),
        },
      ],
    },
    {
      title: "Post-send",
      items: [
        {
          label: "Review status",
          value: review.status,
        },
        {
          label: "Simulation",
          value:
            review.simulationWarning === null ? "Passed" : "Needs attention",
        },
      ],
    },
  ];
}

function toWarning(
  reason: SmartAdjustmentReason,
  isBlocked: boolean,
): SendReviewWarning {
  return {
    code: reason.code,
    title: reason.title,
    detail: reason.message,
    blocking: isBlocked || reason.severity === "critical",
  };
}

/**
 * Builds warning list from simulation and risk indicators.
 */
export function deriveSendWarnings(
  draft: SendReviewDraft,
): SendReviewWarning[] {
  const isBlocked = draft.reviewModel.review.status === "blocked";
  const warnings = draft.reviewModel.review.reasons.map((reason) =>
    toWarning(reason, isBlocked),
  );

  if (warnings.length > 0) {
    return warnings;
  }

  return [
    {
      code: "healthy_review",
      title: "Simulation passed",
      detail:
        "Helio did not detect fee, rent, or route issues for this transaction.",
      blocking: false,
    },
  ];
}

/**
 * Provides sample draft for shell and visual testing.
 */
export function createMockSendReviewDraft(): SendReviewDraft {
  const reviewModel: SendReviewModel = {
    network: "mainnet-beta",
    asset: {
      kind: "native-sol",
      mintAddress: null,
      name: "Solana",
      symbol: "SOL",
      decimals: 9,
      iconUrl: null,
      usdPrice: 172.2,
    },
    recipient: {
      address: "A1b2c3d4e5f6g7h8i9j0kLmNoPqRsTuVwXyZ12345",
      shortAddress: "A1b2...2345",
      label: "Treasury Vault",
      isSavedContact: true,
    },
    urgency: "high",
    review: analyzeSmartTransactionReview({
      asset: {
        kind: "native-sol",
        mintAddress: null,
        name: "Solana",
        symbol: "SOL",
        decimals: 9,
        iconUrl: null,
        usdPrice: 172.2,
      },
      requestedAmount: {
        amountAtomic: "1245000000",
        amountDisplay: "1.245 SOL",
        usdEquivalent: 214.39,
      },
      senderSolBalanceLamports: 1_330_000_000,
      rentExemptionReserveLamports: 890_880,
      estimatedNetworkFeeLamports: 5_000,
      recentPriorityFeeSamples: [
        { slot: 1201, feeLamports: 1_000 },
        { slot: 1202, feeLamports: 1_500 },
        { slot: 1203, feeLamports: 2_000 },
        { slot: 1204, feeLamports: 2_800 },
        { slot: 1205, feeLamports: 4_200 },
      ],
      urgency: "high",
      requiresAssociatedTokenAccount: false,
      associatedTokenAccountRentLamports: 0,
      simulationWarning: null,
      wouldLikelyFailFromSlippage: false,
      slippageWarningMessage: null,
    }),
  };

  const draft: SendReviewDraft = {
    reviewModel,
    warnings: [],
  };

  return { ...draft, warnings: deriveSendWarnings(draft) };
}
