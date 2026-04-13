import type {
  ActivityItem,
  NetworkStatus,
  PortfolioBalanceSummary,
  TokenHolding,
  WalletAccountSummary,
} from "@helio/types";

export interface PopupDashboardSnapshot {
  readonly account: WalletAccountSummary;
  readonly portfolio: PortfolioBalanceSummary;
  readonly network: NetworkStatus;
  readonly tokenRows: readonly TokenHolding[];
  readonly activity: readonly ActivityItem[];
}
