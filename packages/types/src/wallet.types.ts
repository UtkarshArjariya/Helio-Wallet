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

