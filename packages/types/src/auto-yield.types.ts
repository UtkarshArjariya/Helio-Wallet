export type AutoYieldProtocol = "kamino";

export type AutoYieldSweepMode = "round-up" | "percentage";

export type AutoYieldStatus =
  | "disabled"
  | "accumulating"
  | "threshold-reached"
  | "paused";

export interface AutoYieldSettings {
  readonly enabled: boolean;
  readonly paused: boolean;
  readonly sweepMode: AutoYieldSweepMode;
  readonly roundUpUnit: number;
  readonly percentageBps: number;
  readonly deployThresholdUsd: number;
  readonly preferredStableMintAddress: string;
  readonly activeProtocol: AutoYieldProtocol;
  readonly allowedProtocols: readonly AutoYieldProtocol[];
  readonly excludedProtocols: readonly AutoYieldProtocol[];
}

export interface AutoYieldReserveBalance {
  readonly assetKind: "native-sol" | "spl-token";
  readonly mintAddress: string | null;
  readonly symbol: string;
  readonly decimals: number;
  readonly amountAtomic: string;
  readonly amountDisplay: string;
  readonly usdValue: number;
}

export interface AutoYieldReserveSnapshot {
  readonly balances: readonly AutoYieldReserveBalance[];
  readonly totalUsdValue: number;
  readonly totalSweptUsd: number;
  readonly totalDeployedUsd: number;
  readonly availableToDeploy: boolean;
  readonly lastSweepAtIso: string | null;
  readonly lastDeployAtIso: string | null;
}

export interface AutoYieldState {
  readonly settings: AutoYieldSettings;
  readonly reserve: AutoYieldReserveSnapshot;
  readonly status: AutoYieldStatus;
}

export interface AutoYieldSweepQuote {
  readonly amountAtomic: string;
  readonly amountDisplay: string;
  readonly usdEquivalent: number | null;
}

export interface AutoYieldSweepPreview {
  readonly isEnabled: boolean;
  readonly willSweep: boolean;
  readonly sweepAssetSymbol: string | null;
  readonly sweepAmount: AutoYieldSweepQuote | null;
  readonly projectedReserveTotalUsd: number;
  readonly thresholdReachedAfterSend: boolean;
  readonly skipReason: string | null;
}

export interface AutoYieldDeployPreview {
  readonly canDeploy: boolean;
  readonly protocol: AutoYieldProtocol;
  readonly amountDisplay: string;
  readonly usdEquivalent: number;
  readonly requiresSwap: boolean;
  readonly sourceAssetSymbols: readonly string[];
  readonly skipReason: string | null;
}

export interface AutoYieldDeployRequest {
  readonly protocol: AutoYieldProtocol;
}

export interface AutoYieldDeployResult {
  readonly protocol: AutoYieldProtocol;
  readonly deployedAmountDisplay: string;
  readonly signature: string | null;
  readonly status: "ready" | "confirmed";
  readonly explorerLabel: string;
  readonly explorerUrl: string | null;
}

export interface UpdateAutoYieldSettingsRequest {
  readonly settings: AutoYieldSettings;
}
