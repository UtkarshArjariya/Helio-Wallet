import { HelioCoreError } from "@helio/core";
import type {
  ExtensionRequestEnvelope,
  ExtensionRequestMap,
  ExtensionRequestType,
  ExtensionResponseEnvelope,
} from "@helio/types";

import { createHelioExtensionService } from "./extension-service";

const DAPP_APPROVAL_WAIT_TIMEOUT_MS = 120_000;

const extensionService = createHelioExtensionService();

interface PendingDappResponse {
  readonly requestType:
    | "helio/connect-dapp"
    | "helio/sign-dapp-message"
    | "helio/sign-dapp-transaction";
  readonly sendResponse: (
    response: ExtensionResponseEnvelope<PendingDappResponse["requestType"]>,
  ) => void;
  readonly timeoutHandle: ReturnType<typeof setTimeout>;
}

const pendingDappResponses = new Map<string, PendingDappResponse>();

function asDappOriginRequest(
  payload: ExtensionRequestMap[ExtensionRequestType]["request"],
) {
  return payload as ExtensionRequestMap["helio/get-dapp-connection-state"]["request"];
}

function asConnectDappRequest(
  payload: ExtensionRequestMap[ExtensionRequestType]["request"],
) {
  return payload as ExtensionRequestMap["helio/connect-dapp"]["request"];
}

function asSignDappMessageRequest(
  payload: ExtensionRequestMap[ExtensionRequestType]["request"],
) {
  return payload as ExtensionRequestMap["helio/sign-dapp-message"]["request"];
}

function asSignDappTransactionRequest(
  payload: ExtensionRequestMap[ExtensionRequestType]["request"],
) {
  return payload as ExtensionRequestMap["helio/sign-dapp-transaction"]["request"];
}

function getRequestOrigin(
  request: ExtensionRequestEnvelope<ExtensionRequestType>,
): string | null {
  switch (request.type) {
    case "helio/connect-dapp":
      return asConnectDappRequest(request.payload).origin;
    case "helio/disconnect-dapp":
    case "helio/get-dapp-connection-state":
      return asDappOriginRequest(request.payload).origin;
    case "helio/sign-dapp-message":
      return asSignDappMessageRequest(request.payload).origin;
    case "helio/sign-dapp-transaction":
      return asSignDappTransactionRequest(request.payload).origin;
    default:
      return null;
  }
}

function getNormalizedSenderOrigin(
  sender: chrome.runtime.MessageSender,
): string | null {
  if (typeof sender.url !== "string") {
    return null;
  }

  try {
    return new URL(sender.url).origin;
  } catch {
    return null;
  }
}

function assertTrustedSender(
  request: ExtensionRequestEnvelope<ExtensionRequestType>,
  sender: chrome.runtime.MessageSender,
): void {
  const requestOrigin = getRequestOrigin(request);

  if (requestOrigin === null) {
    return;
  }

  const senderOrigin = getNormalizedSenderOrigin(sender);

  if (senderOrigin === requestOrigin) {
    return;
  }

  throw new HelioCoreError(
    "The page origin did not match the requesting tab.",
    "INVALID_DAPP_ORIGIN",
  );
}

function getErrorCode(error: unknown): string {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : "UNKNOWN_ERROR";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The extension request failed.";
}

function getPendingRequestId(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "context" in error &&
    typeof error.context === "object" &&
    error.context !== null &&
    "requestId" in error.context &&
    typeof error.context.requestId === "string"
  ) {
    return error.context.requestId;
  }

  return null;
}

function isApprovalRequiredError(error: unknown): boolean {
  return getErrorCode(error) === "DAPP_APPROVAL_REQUIRED";
}

function isAwaitingApprovalType(
  requestType: ExtensionRequestType,
): requestType is PendingDappResponse["requestType"] {
  return (
    requestType === "helio/connect-dapp" ||
    requestType === "helio/sign-dapp-message" ||
    requestType === "helio/sign-dapp-transaction"
  );
}

async function maybeOpenApprovalPopup(): Promise<void> {
  const openPopup = (
    chrome.action as typeof chrome.action & {
      readonly openPopup?: () => Promise<void>;
    }
  ).openPopup;

  if (typeof openPopup !== "function") {
    return;
  }

  try {
    await openPopup();
  } catch {
    // Popup opening is best-effort. The dApp request remains pending until timeout.
  }
}

function resolvePendingDappResponse(
  requestId: string,
  response:
    | ExtensionResponseEnvelope<"helio/connect-dapp">
    | ExtensionResponseEnvelope<"helio/sign-dapp-message">
    | ExtensionResponseEnvelope<"helio/sign-dapp-transaction">,
): void {
  const pendingResponse = pendingDappResponses.get(requestId);

  if (pendingResponse === undefined) {
    return;
  }

  clearTimeout(pendingResponse.timeoutHandle);
  pendingDappResponses.delete(requestId);
  pendingResponse.sendResponse(
    response as ExtensionResponseEnvelope<PendingDappResponse["requestType"]>,
  );
}

function createPendingApprovalTimeout(
  requestId: string,
): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    resolvePendingDappResponse(requestId, {
      ok: false,
      error: {
        code: "DAPP_APPROVAL_TIMEOUT",
        message: "The dApp request timed out before approval was completed.",
      },
    });
  }, DAPP_APPROVAL_WAIT_TIMEOUT_MS);
}

function awaitPopupDecision(
  requestId: string,
  requestType: PendingDappResponse["requestType"],
  sendResponse: PendingDappResponse["sendResponse"],
): void {
  const timeoutHandle = createPendingApprovalTimeout(requestId);

  pendingDappResponses.set(requestId, {
    requestType,
    sendResponse,
    timeoutHandle,
  });
}

function resolveApprovedRequest(
  approvedRequest: ExtensionRequestMap["helio/approve-dapp-request"]["response"],
): void {
  if (approvedRequest.kind === "connect" && approvedRequest.connectionState) {
    resolvePendingDappResponse(approvedRequest.requestId, {
      ok: true,
      data: approvedRequest.connectionState,
    });
    return;
  }

  if (
    approvedRequest.kind === "sign-transaction" &&
    approvedRequest.signedTransaction
  ) {
    resolvePendingDappResponse(approvedRequest.requestId, {
      ok: true,
      data: approvedRequest.signedTransaction,
    });
    return;
  }

  if (
    approvedRequest.kind === "sign-message" &&
    approvedRequest.signedMessage
  ) {
    resolvePendingDappResponse(approvedRequest.requestId, {
      ok: true,
      data: approvedRequest.signedMessage,
    });
  }
}

function handleRejectedRequest(requestId: string): void {
  resolvePendingDappResponse(requestId, {
    ok: false,
    error: {
      code: "USER_REJECTED",
      message: "The Helio user rejected this dApp request.",
    },
  });
}

async function handleApprovedOrRejectedRequest(
  request: ExtensionRequestEnvelope<ExtensionRequestType>,
): Promise<ExtensionRequestMap[ExtensionRequestType]["response"]> {
  const result = await extensionService.handleRequest(
    request.type,
    request.payload as never,
  );

  if (request.type === "helio/approve-dapp-request") {
    resolveApprovedRequest(
      result as ExtensionRequestMap["helio/approve-dapp-request"]["response"],
    );
  }

  if (request.type === "helio/reject-dapp-request") {
    handleRejectedRequest(
      (result as ExtensionRequestMap["helio/reject-dapp-request"]["response"])
        .requestId,
    );
  }

  return result;
}

/**
 * Registers the extension background message bridge.
 */
function registerBackgroundMessageHandlers(): void {
  chrome.runtime.onMessage.addListener(
    (
      request: ExtensionRequestEnvelope<ExtensionRequestType>,
      sender,
      sendResponse: (response: ExtensionResponseEnvelope) => void,
    ) => {
      Promise.resolve()
        .then(() => {
          assertTrustedSender(request, sender);

          if (
            request.type === "helio/approve-dapp-request" ||
            request.type === "helio/reject-dapp-request"
          ) {
            return handleApprovedOrRejectedRequest(request);
          }

          return extensionService.handleRequest(
            request.type,
            request.payload as never,
          );
        })
        .then((data) => {
          sendResponse({
            ok: true,
            data,
          });
        })
        .catch(async (error: unknown) => {
          if (
            isAwaitingApprovalType(request.type) &&
            isApprovalRequiredError(error)
          ) {
            const requestId = getPendingRequestId(error);

            if (requestId !== null) {
              await maybeOpenApprovalPopup();
              awaitPopupDecision(
                requestId,
                request.type,
                sendResponse as PendingDappResponse["sendResponse"],
              );
              return;
            }
          }

          sendResponse({
            ok: false,
            error: {
              code: getErrorCode(error),
              message: getErrorMessage(error),
            },
          });
        });

      return true;
    },
  );
}

registerBackgroundMessageHandlers();
