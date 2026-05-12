import "../shared/runtime-polyfills";
import { HelioCoreError } from "@helio/core";
import type {
  ExtensionRequestEnvelope,
  ExtensionRequestMap,
  ExtensionRequestType,
  ExtensionResponseEnvelope,
} from "@helio/types";

import { createHelioExtensionService } from "./extension-service";

const DAPP_APPROVAL_WAIT_TIMEOUT_MS = 120_000;

/* ─────────────────────────────────────────────────────────────────────────
 * Launch mode — how clicking the toolbar icon opens the wallet UI.
 *
 *  - "popup":   classic browser-action popup (~400×600).
 *  - "sidebar": Chrome 114+ side panel — persists alongside the page.
 *  - "tab":     full browser tab.
 *
 * Stored in chrome.storage.local so the service worker can read it without
 * touching the page-side localStorage. Default is "sidebar"; first-install
 * opens a welcome tab once.
 * ─────────────────────────────────────────────────────────────────────────*/
type LaunchMode = "popup" | "sidebar" | "tab";
const LAUNCH_MODE_KEY = "helio:launch-mode";
const LAUNCH_MODE_DEFAULT: LaunchMode = "sidebar";

async function readLaunchMode(): Promise<LaunchMode> {
  try {
    const { [LAUNCH_MODE_KEY]: value } = await chrome.storage.local.get(LAUNCH_MODE_KEY);
    if (value === "popup" || value === "sidebar" || value === "tab") return value;
  } catch { /* ignore */ }
  return LAUNCH_MODE_DEFAULT;
}

async function applyLaunchMode(mode: LaunchMode): Promise<void> {
  // Setting an empty popup string is the documented way to clear it so that
  // chrome.action.onClicked fires instead of opening the popup directly.
  try {
    await chrome.action.setPopup({ popup: mode === "popup" ? "index.html" : "" });
  } catch { /* */ }
  try {
    // sidePanel.setPanelBehavior is the toggle that makes the panel open on
    // toolbar-icon click in sidebar mode.
    await chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: mode === "sidebar",
    });
  } catch { /* sidePanel API may be unavailable on older Chromes */ }
}

function openInTab(): void {
  void chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
}

// Apply mode on every service-worker wake so it survives reloads.
void readLaunchMode().then(applyLaunchMode);

// Fresh install: open the wallet in a full tab so onboarding has space.
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    openInTab();
    await chrome.storage.local.set({ [LAUNCH_MODE_KEY]: LAUNCH_MODE_DEFAULT });
  }
  // Always re-apply mode after install / update / chrome restart so the
  // action button + side panel behaviour match the saved preference.
  await applyLaunchMode(await readLaunchMode());
});

// Tab launch is the only mode we need to handle from onClicked. Popup is
// handled by chrome itself via default_popup; sidebar by setPanelBehavior.
chrome.action.onClicked.addListener(async () => {
  const mode = await readLaunchMode();
  if (mode === "tab") openInTab();
  // sidebar: setPanelBehavior already opens it for us; no action needed.
  // popup: never reaches here (default_popup intercepts the click).
});

// React when the user changes the preference from Settings.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[LAUNCH_MODE_KEY]) return;
  const next = changes[LAUNCH_MODE_KEY].newValue as LaunchMode | undefined;
  if (next) void applyLaunchMode(next);
});

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
