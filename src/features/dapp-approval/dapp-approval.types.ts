import type {
  DappIdentity,
  PendingDappRequestKind,
  SendReviewModel,
  TransactionReviewWarning,
} from "@helio/types";

export interface DappApprovalRequest {
  readonly dapp: DappIdentity;
  readonly kind: PendingDappRequestKind;
  readonly messagePreview: string | null;
  readonly requestId: string;
  readonly sendReview: SendReviewModel | null;
  readonly summaryLines: readonly string[];
  readonly warnings: readonly TransactionReviewWarning[];
}
