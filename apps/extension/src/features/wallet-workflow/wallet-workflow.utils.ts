import type {
  SendAssetSummary,
  TokenHolding,
  WalletImportMethod,
} from "@helio/types";

import type {
  CreateTransactionStatusInput,
  WalletWorkflowState,
} from "./wallet-workflow.types";

/**
 * Creates the default extension workflow state before the runtime snapshot loads.
 *
 * @returns Initial workflow state.
 */
export function createInitialWalletWorkflowState(): WalletWorkflowState {
  return {
    activeScreen: "loading",
    actionError: null,
    actionNotice: null,
    confirmPassword: "",
    dashboardSnapshot: null,
    entryMode: "create",
    exportPassword: "",
    exportedMnemonicWords: [],
    hasAcceptedBackupWarning: false,
    importMethod: "seed-phrase",
    importValue: "",
    isBusy: true,
    lastTransaction: null,
    mnemonicWords: [],
    password: "",
    runtimeSnapshot: null,
    settingsCustomRpcUrl: "",
    settingsSelectedNetwork: "mainnet-beta",
    sendDraft: {
      amountInput: "",
      asset: {
        kind: "native-sol",
        mintAddress: null,
        name: "Solana",
        symbol: "SOL",
        decimals: 9,
        iconUrl: null,
        usdPrice: null,
      },
      recipientAddress: "",
      recipientLabel: null,
      urgency: "high",
    },
    sendReview: null,
    unlockPassword: "",
    useAdjustedAmount: true,
    verificationChallenge: null,
    verificationError: null,
    verificationInputs: {},
    biometricsEnabled: false,
  };
}

/**
 * Returns whether the import input matches the supported wallet import formats.
 *
 * @param method - Selected wallet import method.
 * @param value - Raw user input.
 * @returns `true` when the input shape is valid enough to continue.
 */
export function validateImportInput(
  method: WalletImportMethod,
  value: string,
): boolean {
  const normalizedValue = value.trim();

  if (method === "seed-phrase") {
    const words = normalizedValue.split(/\s+/).filter(Boolean);
    return words.length === 12 || words.length === 24;
  }

  return /^[1-9A-HJ-NP-Za-km-z]{32,88}$/.test(normalizedValue);
}

/**
 * Performs a lightweight Solana address validation for the send form.
 *
 * @param address - Candidate recipient address.
 * @returns `true` when the address matches the expected base58 shape.
 */
export function isLikelySolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim());
}

/**
 * Maps a dashboard token row to the send-asset contract used by the extension backend.
 *
 * @param tokenHolding - Selected dashboard holding.
 * @returns Send-asset summary for review and submit requests.
 */
export function createSendAssetFromTokenHolding(
  tokenHolding: TokenHolding | null | undefined,
): SendAssetSummary {
  if (tokenHolding === null || tokenHolding === undefined) {
    return {
      kind: "native-sol",
      mintAddress: null,
      name: "Solana",
      symbol: "SOL",
      decimals: 9,
      iconUrl: null,
      usdPrice: null,
    };
  }

  return {
    kind: tokenHolding.assetKind,
    mintAddress:
      tokenHolding.assetKind === "native-sol" ? null : tokenHolding.mintAddress,
    name: tokenHolding.name,
    symbol: tokenHolding.symbol,
    decimals: tokenHolding.decimals,
    iconUrl: tokenHolding.iconUrl,
    usdPrice: tokenHolding.usdPrice,
  };
}

/**
 * Creates the transaction status model rendered on the final confirmation page.
 *
 * @param input - Submitted transaction result from the extension backend.
 * @returns Transaction status data for the UI.
 */
export function createTransactionStatusModel(
  input: CreateTransactionStatusInput,
) {
  return {
    explorerLabel: input.explorerLabel,
    explorerUrl: input.explorerUrl,
    recipientShortAddress: input.recipientShortAddress,
    sentAmountDisplay: input.sentAmountDisplay,
    signature: input.signature,
    status: input.status,
  } satisfies WalletWorkflowState["lastTransaction"];
}

/**
 * Groups a wallet address into 4-character chunks for easier popup display.
 *
 * @param address - Solana address to group.
 * @returns Grouped address string.
 */
export function groupAddressForDisplay(address: string): string {
  return address.match(/.{1,4}/g)?.join(" ") ?? address;
}
