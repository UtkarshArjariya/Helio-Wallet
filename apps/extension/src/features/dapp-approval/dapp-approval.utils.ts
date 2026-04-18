import type { PendingDappRequest } from "@helio/types";

import type { DappApprovalRequest } from "./dapp-approval.types";

/**
 * Converts a pending runtime dApp request into the approval model consumed by the popup.
 *
 * @param request - Pending dApp request from the extension runtime.
 * @returns Approval screen model rendered by the popup.
 */
export function createApprovalRequestFromPendingRequest(
  request: PendingDappRequest,
): DappApprovalRequest {
  if (request.kind === "connect") {
    return {
      dapp: request.dapp,
      kind: "connect",
      messagePreview: null,
      requestId: request.id,
      sendReview: null,
      summaryLines: [
        "Share the active wallet address with this site.",
        "Allow the site to reconnect until you revoke it in Helio.",
      ],
      warnings: request.warnings,
    };
  }

  if (request.kind === "sign-message") {
    return {
      dapp: request.dapp,
      kind: "sign-message",
      messagePreview: request.messagePreview,
      requestId: request.id,
      sendReview: null,
      summaryLines: request.summaryLines,
      warnings: request.warnings,
    };
  }

  return {
    dapp: request.review.dapp,
    kind: "sign-transaction",
    messagePreview: null,
    requestId: request.id,
    sendReview: request.review.sendReview,
    summaryLines: request.review.summaryLines,
    warnings: request.review.warnings,
  };
}
