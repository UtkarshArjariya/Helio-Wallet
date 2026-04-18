import type { SendReviewModel } from "./send-flow.types";
import type { WalletAccountSummary } from "./wallet.types";

export type DappTrustLevel = "verified" | "unknown" | "flagged";

export type DappPermission = "connect" | "sign-transaction" | "sign-message";

export type PendingDappRequestKind =
  | "connect"
  | "sign-transaction"
  | "sign-message";

export interface DappIdentity {
  readonly name: string;
  readonly origin: string;
  readonly iconUrl: string | null;
  readonly trustLevel: DappTrustLevel;
}

export interface DappRequestMetadata {
  readonly iconUrl: string | null;
  readonly name: string;
  readonly origin: string;
}

export interface DappOriginRequest {
  readonly origin: string;
}

export interface ConnectDappRequest extends DappRequestMetadata {}

export interface RequestDappTransactionSignatureRequest
  extends DappRequestMetadata {
  readonly serializedTransactionBase64: string;
}

export interface RequestDappMessageSignatureRequest
  extends DappRequestMetadata {
  readonly messageBase64: string;
}

export interface DappConnectionState extends DappOriginRequest {
  readonly isConnected: boolean;
  readonly account: WalletAccountSummary | null;
}

export interface DappRequestDecisionRequest {
  readonly requestId: string;
}

export interface DappRequestDecisionResult {
  readonly requestId: string;
}

export interface DappSignedTransactionResult {
  readonly publicKey: string;
  readonly signature: string | null;
  readonly signedTransactionBase64: string;
}

export interface DappSignedMessageResult {
  readonly publicKey: string;
  readonly signatureBase64: string;
  readonly signedMessageBase64: string;
}

export interface DappApprovedRequestResult {
  readonly kind: PendingDappRequestKind;
  readonly requestId: string;
  readonly connectionState?: DappConnectionState;
  readonly signedMessage?: DappSignedMessageResult;
  readonly signedTransaction?: DappSignedTransactionResult;
}

export interface TransactionReviewWarning {
  readonly code:
    | "token-approval"
    | "authority-change"
    | "unknown-program"
    | "phishing-domain"
    | "insecure-origin"
    | "simulation-failed";
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

interface PendingDappRequestBase {
  readonly dapp: DappIdentity;
  readonly id: string;
  readonly requestedAtIso: string;
}

export interface DappConnectionRequest extends PendingDappRequestBase {
  readonly kind: "connect";
  readonly permissions: readonly DappPermission[];
  readonly warnings: readonly TransactionReviewWarning[];
}

export interface DappSignMessageRequest extends PendingDappRequestBase {
  readonly kind: "sign-message";
  readonly messageBase64: string;
  readonly messagePreview: string;
  readonly summaryLines: readonly string[];
  readonly warnings: readonly TransactionReviewWarning[];
}

export interface DappSignTransactionRequest extends PendingDappRequestBase {
  readonly kind: "sign-transaction";
  readonly review: DappTransactionReview;
  readonly serializedTransactionBase64: string;
}

export type PendingDappRequest =
  | DappConnectionRequest
  | DappSignMessageRequest
  | DappSignTransactionRequest;
