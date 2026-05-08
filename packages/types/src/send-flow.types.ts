import type { AutoYieldSweepPreview } from "./auto-yield.types";
import type { HelioNetwork } from "./wallet.types";

export type SendAssetKind = "native-sol" | "spl-token";

export type TransactionUrgency = "low" | "medium" | "high";

export interface SendAssetSummary {
  readonly kind: SendAssetKind;
  readonly mintAddress: string | null;
  readonly name: string;
  readonly symbol: string;
  readonly decimals: number;
  readonly iconUrl: string | null;
  readonly usdPrice: number | null;
}

export interface SendAmountQuote {
  readonly amountAtomic: string;
  readonly amountDisplay: string;
  readonly usdEquivalent: number | null;
}

export interface SendRecipientSummary {
  readonly address: string;
  readonly shortAddress: string;
  readonly label: string | null;
  readonly isSavedContact: boolean;
}

export interface NetworkFeeBreakdown {
  readonly networkFeeLamports: number;
  readonly priorityFeeLamports: number;
  readonly associatedTokenAccountRentLamports: number;
  readonly rentExemptionReserveLamports: number;
  readonly totalLamports: number;
}

export type SmartAdjustmentReasonCode =
  | "rent-exemption"
  | "associated-token-account"
  | "priority-fee"
  | "insufficient-sol-for-fees"
  | "simulation-warning"
  | "slippage-warning";

export interface SmartAdjustmentReason {
  readonly code: SmartAdjustmentReasonCode;
  readonly title: string;
  readonly message: string;
  readonly amountLamports: number;
  readonly severity: "info" | "warning" | "critical";
}

export type SendReviewStatus = "ready" | "adjusted" | "blocked";

export interface SmartTransactionReview {
  readonly status: SendReviewStatus;
  readonly originalAmount: SendAmountQuote;
  readonly adjustedAmount: SendAmountQuote;
  readonly feeBreakdown: NetworkFeeBreakdown;
  readonly reasons: readonly SmartAdjustmentReason[];
  readonly simulationWarning: string | null;
  readonly canSendOriginalAmount: boolean;
}

export interface SendReviewModel {
  readonly network: HelioNetwork;
  readonly asset: SendAssetSummary;
  readonly recipient: SendRecipientSummary;
  readonly urgency: TransactionUrgency;
  readonly review: SmartTransactionReview;
  readonly autoYield: AutoYieldSweepPreview | null;
}

export interface PriorityFeeSample {
  readonly slot: number;
  readonly feeLamports: number;
}

export interface SmartTransactionAnalysisInput {
  readonly asset: SendAssetSummary;
  readonly requestedAmount: SendAmountQuote;
  readonly senderSolBalanceLamports: number;
  readonly rentExemptionReserveLamports: number;
  readonly estimatedNetworkFeeLamports: number;
  readonly recentPriorityFeeSamples: readonly PriorityFeeSample[];
  readonly urgency: TransactionUrgency;
  readonly requiresAssociatedTokenAccount: boolean;
  readonly associatedTokenAccountRentLamports: number;
  readonly simulationWarning: string | null;
  readonly wouldLikelyFailFromSlippage: boolean;
  readonly slippageWarningMessage: string | null;
}
