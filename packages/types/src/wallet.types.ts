export type HelioNetwork = "mainnet-beta" | "devnet" | "custom";

export type WalletLockState = "locked" | "unlocked";

export type WalletAccountKind = "derived" | "imported";

export interface WalletAccountSummary {
  readonly address: string;
  readonly label: string;
  readonly derivationIndex: number;
  readonly kind: WalletAccountKind;
  readonly shortAddress: string;
}

export interface WalletSessionState {
  readonly activeNetwork: HelioNetwork;
  readonly activeAccountAddress: string | null;
  readonly lockState: WalletLockState;
  readonly autoLockDeadlineIso: string | null;
}

export interface WalletOnboardingState {
  readonly currentStep:
    | "welcome"
    | "password"
    | "backup"
    | "verify"
    | "biometrics"
    | "complete";
  readonly hasAcceptedBackupWarning: boolean;
  readonly hasVerifiedSeedPhrase: boolean;
  readonly biometricsEnabled: boolean;
}

export interface WalletSecurityPreferences {
  readonly biometricsEnabled: boolean;
  readonly autoLockTimeoutMinutes: 0 | 1 | 5 | 15 | 30;
  readonly trustedOrigins: readonly string[];
}
