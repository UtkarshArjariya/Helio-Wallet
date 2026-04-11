export type HelioNetwork = 'mainnet-beta' | 'devnet' | 'custom';

export type WalletLockState = 'locked' | 'unlocked';

export interface WalletAccountSummary {
  readonly address: string;
  readonly label: string;
  readonly derivationIndex: number;
}

export interface WalletSessionState {
  readonly activeNetwork: HelioNetwork;
  readonly activeAccountAddress: string | null;
  readonly lockState: WalletLockState;
}

export interface WalletOnboardingState {
  readonly hasAcceptedBackupWarning: boolean;
  readonly hasVerifiedSeedPhrase: boolean;
  readonly biometricsEnabled: boolean;
}

