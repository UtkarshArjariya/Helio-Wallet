import type { SendReviewModel, SmartAdjustmentReasonCode } from "@helio/types";

export type SendWarningCode =
  | SmartAdjustmentReasonCode
  | "blocked_review"
  | "healthy_review";

export interface SendReviewWarning {
  readonly code: SendWarningCode;
  readonly title: string;
  readonly detail: string;
  readonly blocking: boolean;
}

export interface SendReviewDraft {
  readonly reviewModel: SendReviewModel;
  readonly warnings: readonly SendReviewWarning[];
}

export interface SendReviewSectionItem {
  readonly label: string;
  readonly value: string;
}

export interface SendReviewSection {
  readonly title: string;
  readonly items: readonly SendReviewSectionItem[];
}
