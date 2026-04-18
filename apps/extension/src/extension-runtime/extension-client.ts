import type {
  ExtensionRequestMap,
  ExtensionRequestType,
  WalletRuntimeSnapshot,
} from "@helio/types";

async function sendChromeMessage<TType extends ExtensionRequestType>(
  type: TType,
  payload: ExtensionRequestMap[TType]["request"],
): Promise<ExtensionRequestMap[TType]["response"]> {
  const response = await chrome.runtime.sendMessage({
    type,
    payload,
  });

  if (response.ok) {
    return response.data;
  }

  throw new Error(response.error.message);
}

async function sendLocalMessage<TType extends ExtensionRequestType>(
  type: TType,
  payload: ExtensionRequestMap[TType]["request"],
): Promise<ExtensionRequestMap[TType]["response"]> {
  const { sendLocalExtensionMessage } = await import(
    "./local-extension-client"
  );

  return sendLocalExtensionMessage(type, payload);
}

/**
 * Creates the popup client for the extension backend.
 *
 * @returns Message-sending helpers backed by `chrome.runtime` or local fallback.
 */
export function createExtensionClient() {
  const sendMessage =
    typeof chrome !== "undefined" && chrome.runtime?.id !== undefined
      ? sendChromeMessage
      : sendLocalMessage;

  return {
    beginWalletCreation() {
      return sendMessage("helio/begin-wallet-creation", undefined);
    },
    approveDappRequest(
      request: ExtensionRequestMap["helio/approve-dapp-request"]["request"],
    ) {
      return sendMessage("helio/approve-dapp-request", request);
    },
    createWallet(
      request: ExtensionRequestMap["helio/create-wallet"]["request"],
    ) {
      return sendMessage("helio/create-wallet", request);
    },
    connectDapp(request: ExtensionRequestMap["helio/connect-dapp"]["request"]) {
      return sendMessage("helio/connect-dapp", request);
    },
    disconnectDapp(
      request: ExtensionRequestMap["helio/disconnect-dapp"]["request"],
    ) {
      return sendMessage("helio/disconnect-dapp", request);
    },
    exportMnemonic(
      request: ExtensionRequestMap["helio/export-mnemonic"]["request"],
    ) {
      return sendMessage("helio/export-mnemonic", request);
    },
    getDappConnectionState(
      request: ExtensionRequestMap["helio/get-dapp-connection-state"]["request"],
    ) {
      return sendMessage("helio/get-dapp-connection-state", request);
    },
    getPendingDappRequest() {
      return sendMessage("helio/get-pending-dapp-request", undefined);
    },
    getRuntimeSnapshot(): Promise<WalletRuntimeSnapshot> {
      return sendMessage("helio/get-runtime-snapshot", undefined);
    },
    importWallet(
      request: ExtensionRequestMap["helio/import-wallet"]["request"],
    ) {
      return sendMessage("helio/import-wallet", request);
    },
    lockWallet() {
      return sendMessage("helio/lock-wallet", undefined);
    },
    refreshDashboard() {
      return sendMessage("helio/refresh-dashboard", undefined);
    },
    reviewSend(request: ExtensionRequestMap["helio/review-send"]["request"]) {
      return sendMessage("helio/review-send", request);
    },
    rejectDappRequest(
      request: ExtensionRequestMap["helio/reject-dapp-request"]["request"],
    ) {
      return sendMessage("helio/reject-dapp-request", request);
    },
    signDappMessage(
      request: ExtensionRequestMap["helio/sign-dapp-message"]["request"],
    ) {
      return sendMessage("helio/sign-dapp-message", request);
    },
    signDappTransaction(
      request: ExtensionRequestMap["helio/sign-dapp-transaction"]["request"],
    ) {
      return sendMessage("helio/sign-dapp-transaction", request);
    },
    submitSend(request: ExtensionRequestMap["helio/submit-send"]["request"]) {
      return sendMessage("helio/submit-send", request);
    },
    unlockWallet(
      request: ExtensionRequestMap["helio/unlock-wallet"]["request"],
    ) {
      return sendMessage("helio/unlock-wallet", request);
    },
    updateNetworkPreference(
      request: ExtensionRequestMap["helio/update-network-preference"]["request"],
    ) {
      return sendMessage("helio/update-network-preference", request);
    },
  };
}
