import type {
  SeedPhraseVerificationChallenge,
  SendAssetSummary,
  SendReviewModel,
  SendTransactionResult,
  TransactionUrgency,
  WalletDashboardSnapshot,
  WalletImportMethod,
  WalletRuntimeSnapshot,
} from "@helio/types";

export type WalletWorkflowScreen =
  | "loading"
  | "welcome"
  | "unlock"
  | "create-password"
  | "backup"
  | "verify"
  | "biometrics"
  | "import-wallet"
  | "dashboard"
  | "asset-detail"
  | "swap"
  | "history"
  | "profile"
  | "staking"
  | "receive"
  | "settings"
  | "send-form"
  | "send-review"
  | "transaction-status";

export type WalletWorkflowEntryMode = "create" | "import";

export interface WalletWorkflowSendDraft {
  readonly asset: SendAssetSummary;
  readonly amountInput: string;
  readonly recipientAddress: string;
  readonly recipientLabel: string | null;
  readonly urgency: TransactionUrgency;
}

export interface WalletWorkflowTransactionStatus {
  readonly status: "pending" | "confirmed";
  readonly signature: string;
  readonly sentAmountDisplay: string;
  readonly recipientShortAddress: string;
  readonly explorerLabel: string;
  readonly explorerUrl: string | null;
}

export interface WalletWorkflowState {
  readonly activeScreen: WalletWorkflowScreen;
  readonly actionNotice: string | null;
  readonly entryMode: WalletWorkflowEntryMode;
  readonly runtimeSnapshot: WalletRuntimeSnapshot | null;
  readonly dashboardSnapshot: WalletDashboardSnapshot | null;
  readonly selectedAssetMintAddress: string | null;
  readonly password: string;
  readonly confirmPassword: string;
  readonly unlockPassword: string;
  readonly mnemonicWords: readonly string[];
  readonly hasAcceptedBackupWarning: boolean;
  readonly verificationChallenge: SeedPhraseVerificationChallenge | null;
  readonly verificationInputs: Readonly<Record<number, string>>;
  readonly verificationError: string | null;
  readonly importMethod: WalletImportMethod;
  readonly importValue: string;
  readonly biometricsEnabled: boolean;
  readonly settingsSelectedNetwork: WalletRuntimeSnapshot["wallet"]["networkPreference"]["selectedNetwork"];
  readonly settingsCustomRpcUrl: string;
  readonly sendDraft: WalletWorkflowSendDraft;
  readonly sendReview: SendReviewModel | null;
  readonly useAdjustedAmount: boolean;
  readonly lastTransaction: WalletWorkflowTransactionStatus | null;
  readonly exportPassword: string;
  readonly exportedMnemonicWords: readonly string[];
  readonly actionError: string | null;
  readonly isBusy: boolean;
}

export type CreateTransactionStatusInput = Pick<
  SendTransactionResult,
  | "explorerLabel"
  | "explorerUrl"
  | "recipientShortAddress"
  | "sentAmountDisplay"
  | "signature"
  | "status"
>;
