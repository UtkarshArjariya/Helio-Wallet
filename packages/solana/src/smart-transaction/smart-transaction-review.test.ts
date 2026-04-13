import type { SmartTransactionAnalysisInput } from "@helio/types";
import { describe, expect, it } from "vitest";

import { analyzeSmartTransactionReview } from "./smart-transaction-review";

const BASE_INPUT: SmartTransactionAnalysisInput = {
  asset: {
    kind: "native-sol",
    mintAddress: null,
    name: "Solana",
    symbol: "SOL",
    decimals: 9,
    iconUrl: null,
    usdPrice: 150,
  },
  requestedAmount: {
    amountAtomic: "5000000000",
    amountDisplay: "5 SOL",
    usdEquivalent: 750,
  },
  senderSolBalanceLamports: 5_000_500_000,
  rentExemptionReserveLamports: 890_880,
  estimatedNetworkFeeLamports: 5_000,
  recentPriorityFeeSamples: [
    { slot: 1, feeLamports: 1_000 },
    { slot: 2, feeLamports: 2_000 },
    { slot: 3, feeLamports: 3_000 },
    { slot: 4, feeLamports: 4_000 },
    { slot: 5, feeLamports: 5_000 },
  ],
  urgency: "high",
  requiresAssociatedTokenAccount: false,
  associatedTokenAccountRentLamports: 0,
  simulationWarning: null,
  wouldLikelyFailFromSlippage: false,
  slippageWarningMessage: null,
};

describe("analyzeSmartTransactionReview", () => {
  it("adjusts a native SOL send amount to preserve reserve and fees", () => {
    const review = analyzeSmartTransactionReview(BASE_INPUT);

    expect(review.status).toBe("adjusted");
    expect(review.adjustedAmount.amountAtomic).toBe("4999600120");
    expect(review.canSendOriginalAmount).toBe(true);
    expect(review.reasons.map((reason) => reason.code)).toEqual([
      "rent-exemption",
      "priority-fee",
    ]);
  });

  it("surfaces associated token account rent for SPL token sends", () => {
    const review = analyzeSmartTransactionReview({
      ...BASE_INPUT,
      asset: {
        ...BASE_INPUT.asset,
        kind: "spl-token",
        mintAddress: "So11111111111111111111111111111111111111112",
        name: "USD Coin",
        symbol: "USDC",
        decimals: 6,
      },
      requestedAmount: {
        amountAtomic: "2500000",
        amountDisplay: "2.5 USDC",
        usdEquivalent: 2.5,
      },
      senderSolBalanceLamports: 3_000_000,
      rentExemptionReserveLamports: 0,
      associatedTokenAccountRentLamports: 2_039_280,
      requiresAssociatedTokenAccount: true,
    });

    expect(review.status).toBe("adjusted");
    expect(review.adjustedAmount.amountAtomic).toBe("2500000");
    expect(review.canSendOriginalAmount).toBe(false);
    expect(review.reasons.map((reason) => reason.code)).toContain(
      "associated-token-account",
    );
  });

  it("blocks the review when slippage risk is already known", () => {
    const review = analyzeSmartTransactionReview({
      ...BASE_INPUT,
      wouldLikelyFailFromSlippage: true,
      slippageWarningMessage:
        "Quoted output is outside the allowed slippage window.",
    });

    expect(review.status).toBe("blocked");
    expect(review.canSendOriginalAmount).toBe(false);
    expect(review.reasons.map((reason) => reason.code)).toContain(
      "slippage-warning",
    );
  });
});
