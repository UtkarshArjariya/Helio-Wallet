import type {
  AutoYieldDeployPreview,
  AutoYieldDeployRequest,
  AutoYieldDeployResult,
  AutoYieldState,
  UpdateAutoYieldSettingsRequest,
} from "./auto-yield.types";
import type {
  ConnectDappRequest,
  DappApprovedRequestResult,
  DappConnectionState,
  DappOriginRequest,
  DappRequestDecisionRequest,
  DappRequestDecisionResult,
  DappSignedMessageResult,
  DappSignedTransactionResult,
  PendingDappRequest,
  RequestDappMessageSignatureRequest,
  RequestDappTransactionSignatureRequest,
} from "./dapp.types";
import type {
  NetworkPreference,
  NetworkStatus,
  RpcEndpointConfig,
} from "./network.types";
import type {
  SeedPhraseVerificationChallenge,
  WalletImportMethod,
} from "./onboarding.types";
import type {
  ActivityItem,
  PortfolioBalanceSummary,
  TokenHolding,
} from "./portfolio.types";
import type {
  SendAssetSummary,
  SendReviewModel,
  TransactionUrgency,
} from "./send-flow.types";
import type {
  WalletAccountSummary,
  WalletLockState,
  WalletSecurityPreferences,
} from "./wallet.types";

export type ExtensionVaultKind = "mnemonic" | "private-key";

export interface EncryptedPayload {
  readonly algorithm: "aes-gcm";
  readonly keyDerivation: "pbkdf2";
  readonly iterations: number;
  readonly saltHex: string;
  readonly ivHex: string;
  readonly cipherTextHex: string;
}

export interface StoredWalletVault {
  readonly schemaVersion: 1;
  readonly kind: ExtensionVaultKind;
  readonly primaryAccount: WalletAccountSummary;
  readonly encryptedPayload: EncryptedPayload;
  readonly mnemonicWordCount: 12 | 24 | null;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
}

export interface WalletDashboardSnapshot {
  readonly account: WalletAccountSummary;
  readonly portfolio: PortfolioBalanceSummary;
  readonly network: NetworkStatus;
  readonly tokenRows: readonly TokenHolding[];
  readonly activity: readonly ActivityItem[];
  readonly autoYield: AutoYieldState;
}

export interface WalletPublicState {
  readonly hasWallet: boolean;
  readonly lockState: WalletLockState;
  readonly account: WalletAccountSummary | null;
  readonly securityPreferences: WalletSecurityPreferences;
  readonly networkPreference: NetworkPreference;
  readonly activeRpcEndpoint: RpcEndpointConfig;
}

export interface WalletRuntimeSnapshot {
  readonly wallet: WalletPublicState;
  readonly dashboard: WalletDashboardSnapshot | null;
}

export interface WalletCreationPreview {
  readonly mnemonicWords: readonly string[];
  readonly verificationChallenge: SeedPhraseVerificationChallenge;
}

export interface CreateWalletRequest {
  readonly password: string;
  readonly mnemonicWords: readonly string[];
  readonly biometricsEnabled: boolean;
}

export interface ImportWalletRequest {
  readonly password: string;
  readonly importMethod: WalletImportMethod;
  readonly importValue: string;
  readonly biometricsEnabled: boolean;
}

export interface UnlockWalletRequest {
  readonly password: string;
}

export interface ExportMnemonicRequest {
  readonly password: string;
}

export interface SendDraftRequest {
  readonly asset: SendAssetSummary;
  readonly amountInput: string;
  readonly recipientAddress: string;
  readonly recipientLabel: string | null;
  readonly urgency: TransactionUrgency;
}

export interface SendTransactionRequest {
  readonly draft: SendDraftRequest;
  readonly useAdjustedAmount: boolean;
}

export interface SendTransactionResult {
  readonly signature: string;
  readonly sentAmountDisplay: string;
  readonly recipientShortAddress: string;
  readonly explorerLabel: string;
  readonly explorerUrl: string | null;
  readonly status: "pending" | "confirmed";
}

export interface UpdateNetworkPreferenceRequest {
  readonly selectedNetwork: NetworkPreference["selectedNetwork"];
  readonly customRpcUrl: string | null;
}

export interface ExtensionRequestMap {
  readonly "helio/get-runtime-snapshot": {
    readonly request: undefined;
    readonly response: WalletRuntimeSnapshot;
  };
  readonly "helio/begin-wallet-creation": {
    readonly request: undefined;
    readonly response: WalletCreationPreview;
  };
  readonly "helio/create-wallet": {
    readonly request: CreateWalletRequest;
    readonly response: WalletRuntimeSnapshot;
  };
  readonly "helio/import-wallet": {
    readonly request: ImportWalletRequest;
    readonly response: WalletRuntimeSnapshot;
  };
  readonly "helio/unlock-wallet": {
    readonly request: UnlockWalletRequest;
    readonly response: WalletRuntimeSnapshot;
  };
  readonly "helio/lock-wallet": {
    readonly request: undefined;
    readonly response: WalletRuntimeSnapshot;
  };
  readonly "helio/export-mnemonic": {
    readonly request: ExportMnemonicRequest;
    readonly response: readonly string[];
  };
  readonly "helio/refresh-dashboard": {
    readonly request: undefined;
    readonly response: WalletDashboardSnapshot;
  };
  readonly "helio/get-auto-yield-state": {
    readonly request: undefined;
    readonly response: AutoYieldState;
  };
  readonly "helio/update-auto-yield-settings": {
    readonly request: UpdateAutoYieldSettingsRequest;
    readonly response: WalletRuntimeSnapshot;
  };
  readonly "helio/review-auto-yield-deploy": {
    readonly request: undefined;
    readonly response: AutoYieldDeployPreview;
  };
  readonly "helio/submit-auto-yield-deploy": {
    readonly request: AutoYieldDeployRequest;
    readonly response: AutoYieldDeployResult;
  };
  readonly "helio/review-send": {
    readonly request: SendDraftRequest;
    readonly response: SendReviewModel;
  };
  readonly "helio/submit-send": {
    readonly request: SendTransactionRequest;
    readonly response: SendTransactionResult;
  };
  readonly "helio/update-network-preference": {
    readonly request: UpdateNetworkPreferenceRequest;
    readonly response: WalletRuntimeSnapshot;
  };
  readonly "helio/get-pending-dapp-request": {
    readonly request: undefined;
    readonly response: PendingDappRequest | null;
  };
  readonly "helio/connect-dapp": {
    readonly request: ConnectDappRequest;
    readonly response: DappConnectionState;
  };
  readonly "helio/sign-dapp-transaction": {
    readonly request: RequestDappTransactionSignatureRequest;
    readonly response: DappSignedTransactionResult;
  };
  readonly "helio/sign-dapp-message": {
    readonly request: RequestDappMessageSignatureRequest;
    readonly response: DappSignedMessageResult;
  };
  readonly "helio/disconnect-dapp": {
    readonly request: DappOriginRequest;
    readonly response: DappConnectionState;
  };
  readonly "helio/get-dapp-connection-state": {
    readonly request: DappOriginRequest;
    readonly response: DappConnectionState;
  };
  readonly "helio/approve-dapp-request": {
    readonly request: DappRequestDecisionRequest;
    readonly response: DappApprovedRequestResult;
  };
  readonly "helio/reject-dapp-request": {
    readonly request: DappRequestDecisionRequest;
    readonly response: DappRequestDecisionResult;
  };
}

export type ExtensionRequestType = keyof ExtensionRequestMap;

export interface ExtensionRequestEnvelope<
  TType extends ExtensionRequestType = ExtensionRequestType,
> {
  readonly type: TType;
  readonly payload: ExtensionRequestMap[TType]["request"];
}

export interface ExtensionServiceError {
  readonly code: string;
  readonly message: string;
}

export type ExtensionResponseEnvelope<
  TType extends ExtensionRequestType = ExtensionRequestType,
> =
  | {
      readonly ok: true;
      readonly data: ExtensionRequestMap[TType]["response"];
    }
  | {
      readonly ok: false;
      readonly error: ExtensionServiceError;
    };
