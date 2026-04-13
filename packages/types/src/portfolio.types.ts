export interface PortfolioBalanceSummary {
  readonly totalUsdValue: number;
  readonly dailyChangeUsd: number;
  readonly dailyChangePercentage: number;
  readonly lastUpdatedIso: string;
}

export interface TokenHolding {
  readonly mintAddress: string;
  readonly name: string;
  readonly symbol: string;
  readonly iconUrl: string | null;
  readonly amountDisplay: string;
  readonly usdValue: number;
  readonly dailyChangePercentage: number;
  readonly isSpam: boolean;
}

export type ActivityStatus = "pending" | "confirmed" | "failed";

export type ActivityKind =
  | "send"
  | "receive"
  | "swap"
  | "stake"
  | "unstake"
  | "dapp";

export interface ActivityItem {
  readonly id: string;
  readonly kind: ActivityKind;
  readonly title: string;
  readonly subtitle: string;
  readonly amountDisplay: string;
  readonly status: ActivityStatus;
  readonly timestampIso: string;
  readonly explorerUrl: string | null;
}

export interface AddressBookEntry {
  readonly address: string;
  readonly label: string;
  readonly createdAtIso: string;
  readonly isFavorite: boolean;
}
