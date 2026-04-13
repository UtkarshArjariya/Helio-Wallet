import type { SendReviewModel } from "./send-flow.types";

export type DappTrustLevel = "verified" | "unknown" | "flagged";

export type DappPermission = "connect" | "sign-transaction" | "sign-message";

export interface DappIdentity {
  readonly name: string;
  readonly origin: string;
  readonly iconUrl: string | null;
  readonly trustLevel: DappTrustLevel;
}

export interface DappConnectionRequest {
  readonly id: string;
  readonly requestedAtIso: string;
  readonly dapp: DappIdentity;
  readonly permissions: readonly DappPermission[];
}

export interface TransactionReviewWarning {
  readonly code:
    | "token-approval"
    | "authority-change"
    | "unknown-program"
    | "phishing-domain";
  readonly title: string;
  readonly message: string;
  readonly severity: "warning" | "critical";
}

export interface DappTransactionReview {
  readonly requestId: string;
  readonly dapp: DappIdentity;
  readonly summaryLines: readonly string[];
  readonly warnings: readonly TransactionReviewWarning[];
  readonly sendReview: SendReviewModel | null;
}
