import type {
  AutoYieldDeployPreview,
  AutoYieldSettings,
  AutoYieldState,
  AutoYieldStatus,
  AutoYieldSweepPreview,
  SendAssetSummary,
} from "@helio/types";

export const HELIO_AUTO_YIELD_USDC_MINT_ADDRESS =
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const DEFAULT_ROUND_UP_UNIT = 0.05;
const DEFAULT_PERCENTAGE_BPS = 100;
const DEFAULT_DEPLOY_THRESHOLD_USD = 25;

function trimTrailingZeros(value: string): string {
  return value.replace(/\.?0+$/, "");
}

function formatAtomicAmount(amountAtomic: bigint, decimals: number): string {
  if (decimals === 0) {
    return amountAtomic.toString();
  }

  const paddedValue = amountAtomic.toString().padStart(decimals + 1, "0");
  const wholePart = paddedValue.slice(0, -decimals);
  const fractionalPart = paddedValue.slice(-decimals);

  return trimTrailingZeros(`${wholePart}.${fractionalPart}`);
}

function formatDisplayAmount(
  amountAtomic: bigint,
  decimals: number,
  symbol: string,
): string {
  return `${formatAtomicAmount(amountAtomic, decimals)} ${symbol}`;
}

function formatStableUsdAmount(value: number): string {
  return `${value.toFixed(2)} USDC`;
}

function getAmountUsdValue(
  amountAtomic: bigint,
  decimals: number,
  usdPrice: number | null,
): number {
  if (usdPrice === null) {
    return 0;
  }

  return Number(((Number(amountAtomic) / 10 ** decimals) * usdPrice).toFixed(2));
}

function toAtomicFromNumber(value: number, decimals: number): bigint {
  const normalizedValue = value.toFixed(decimals);
  const [wholePart, fractionPart = ""] = normalizedValue.split(".");

  return BigInt(`${wholePart}${fractionPart.padEnd(decimals, "0")}`);
}

function clampPercentageBps(value: number): number {
  return Math.min(Math.max(Math.round(value), 1), 10_000);
}

function normalizeRoundUpUnit(value: number): number {
  return Number.isFinite(value) && value > 0 ? Number(value.toFixed(2)) : 0.01;
}

function getStatusForState(state: AutoYieldState): AutoYieldStatus {
  if (!state.settings.enabled) {
    return "disabled";
  }

  if (state.settings.paused) {
    return "paused";
  }

  return state.reserve.totalUsdValue >= state.settings.deployThresholdUsd
    ? "threshold-reached"
    : "accumulating";
}

function getSweepSkipPreview(
  state: AutoYieldState,
  skipReason: string,
): AutoYieldSweepPreview {
  return {
    isEnabled: state.settings.enabled,
    willSweep: false,
    sweepAssetSymbol: null,
    sweepAmount: null,
    projectedReserveTotalUsd: state.reserve.totalUsdValue,
    thresholdReachedAfterSend:
      state.reserve.totalUsdValue >= state.settings.deployThresholdUsd,
    skipReason,
  };
}

function getSweepAmountAtomic(input: {
  readonly asset: SendAssetSummary;
  readonly amountAtomic: bigint;
  readonly settings: AutoYieldSettings;
}): bigint {
  if (input.settings.sweepMode === "percentage") {
    return (
      (input.amountAtomic * BigInt(input.settings.percentageBps)) / 10_000n
    );
  }

  if (input.asset.kind !== "native-sol") {
    return 0n;
  }

  const roundUpUnitAtomic = toAtomicFromNumber(
    input.settings.roundUpUnit,
    input.asset.decimals,
  );
  const remainder = input.amountAtomic % roundUpUnitAtomic;

  return remainder === 0n ? 0n : roundUpUnitAtomic - remainder;
}

function upsertReserveBalance(input: {
  readonly amountAtomic: bigint;
  readonly asset: SendAssetSummary;
  readonly reserveBalances: AutoYieldState["reserve"]["balances"];
}): AutoYieldState["reserve"]["balances"] {
  const nextBalances = input.reserveBalances.slice();
  const balanceIndex = nextBalances.findIndex(
    (balance) =>
      balance.assetKind === input.asset.kind &&
      balance.mintAddress === input.asset.mintAddress,
  );
  const previousAmountAtomic =
    balanceIndex === -1
      ? 0n
      : BigInt(nextBalances[balanceIndex]?.amountAtomic ?? "0");
  const nextAmountAtomic = previousAmountAtomic + input.amountAtomic;
  const nextBalance = {
    assetKind: input.asset.kind,
    mintAddress: input.asset.mintAddress,
    symbol: input.asset.symbol,
    decimals: input.asset.decimals,
    amountAtomic: nextAmountAtomic.toString(),
    amountDisplay: formatAtomicAmount(nextAmountAtomic, input.asset.decimals),
    usdValue: getAmountUsdValue(
      nextAmountAtomic,
      input.asset.decimals,
      input.asset.usdPrice,
    ),
  } as const;

  if (balanceIndex === -1) {
    nextBalances.push(nextBalance);
    return nextBalances;
  }

  nextBalances[balanceIndex] = nextBalance;
  return nextBalances;
}

/**
 * Creates the default AutoYield state used when a wallet is first initialized.
 *
 * @returns Default settings, reserve snapshot, and derived status.
 */
export function createDefaultAutoYieldState(): AutoYieldState {
  const state: AutoYieldState = {
    settings: {
      enabled: false,
      paused: false,
      sweepMode: "round-up",
      roundUpUnit: DEFAULT_ROUND_UP_UNIT,
      percentageBps: DEFAULT_PERCENTAGE_BPS,
      deployThresholdUsd: DEFAULT_DEPLOY_THRESHOLD_USD,
      preferredStableMintAddress: HELIO_AUTO_YIELD_USDC_MINT_ADDRESS,
      activeProtocol: "kamino",
      allowedProtocols: ["kamino"],
      excludedProtocols: [],
    },
    reserve: {
      balances: [],
      totalUsdValue: 0,
      totalSweptUsd: 0,
      totalDeployedUsd: 0,
      availableToDeploy: false,
      lastSweepAtIso: null,
      lastDeployAtIso: null,
    },
    status: "disabled",
  };

  return {
    ...state,
    status: getStatusForState(state),
  };
}

/**
 * Normalizes AutoYield settings before they are persisted to extension storage.
 *
 * @param settings - Raw settings update from the popup UI.
 * @returns Sanitized settings with valid ranges and a consistent protocol set.
 */
export function coerceAutoYieldSettings(
  settings: AutoYieldSettings,
): AutoYieldSettings {
  const allowedProtocols = [...new Set(settings.allowedProtocols)];
  const excludedProtocols = [...new Set(settings.excludedProtocols)].filter(
    (protocol) => !allowedProtocols.includes(protocol),
  );
  const activeProtocol = allowedProtocols.includes(settings.activeProtocol)
    ? settings.activeProtocol
    : "kamino";

  return {
    ...settings,
    activeProtocol,
    allowedProtocols:
      allowedProtocols.length > 0 ? allowedProtocols : ["kamino"],
    excludedProtocols,
    percentageBps: clampPercentageBps(settings.percentageBps),
    deployThresholdUsd:
      Number.isFinite(settings.deployThresholdUsd) &&
      settings.deployThresholdUsd > 0
        ? Number(settings.deployThresholdUsd.toFixed(2))
        : DEFAULT_DEPLOY_THRESHOLD_USD,
    roundUpUnit: normalizeRoundUpUnit(settings.roundUpUnit),
  };
}

/**
 * Recomputes the derived status fields on an AutoYield state snapshot.
 *
 * @param state - Current AutoYield state.
 * @returns State with normalized settings, deploy availability, and status.
 */
export function normalizeAutoYieldState(state: AutoYieldState): AutoYieldState {
  const nextSettings = coerceAutoYieldSettings(state.settings);
  const nextState = {
    ...state,
    settings: nextSettings,
    reserve: {
      ...state.reserve,
      availableToDeploy:
        state.reserve.totalUsdValue >= nextSettings.deployThresholdUsd,
    },
  };

  return {
    ...nextState,
    status: getStatusForState(nextState),
  };
}

/**
 * Calculates the AutoYield sweep preview for a reviewed send request.
 *
 * @param input - Asset, amount, current state, and runtime readiness.
 * @returns Preview describing whether a sweep will be attempted.
 */
export function calculateAutoYieldSweepPreview(input: {
  readonly asset: SendAssetSummary;
  readonly amountAtomic: string;
  readonly state: AutoYieldState;
  readonly isProgramReady: boolean;
}): AutoYieldSweepPreview {
  const state = normalizeAutoYieldState(input.state);

  if (!state.settings.enabled) {
    return getSweepSkipPreview(state, "AutoYield is turned off.");
  }

  if (state.settings.paused) {
    return getSweepSkipPreview(state, "AutoYield is paused.");
  }

  if (!input.isProgramReady) {
    return getSweepSkipPreview(
      state,
      "AutoYield reserve scaffolding exists locally, but the program is not deployed in this runtime yet.",
    );
  }

  if (state.settings.excludedProtocols.includes(state.settings.activeProtocol)) {
    return getSweepSkipPreview(
      state,
      "The active protocol is excluded by the current AutoYield policy.",
    );
  }

  if (input.asset.kind === "spl-token") {
    if (input.asset.mintAddress !== state.settings.preferredStableMintAddress) {
      return getSweepSkipPreview(
        state,
        "Only the preferred stablecoin can be swept from SPL sends in v1.",
      );
    }

    if (state.settings.sweepMode === "round-up") {
      return getSweepSkipPreview(
        state,
        "Round-up sweeps only apply to native SOL sends in v1.",
      );
    }
  }

  const amountAtomic = BigInt(input.amountAtomic);
  const sweepAmountAtomic = getSweepAmountAtomic({
    asset: input.asset,
    amountAtomic,
    settings: state.settings,
  });

  if (sweepAmountAtomic <= 0n) {
    return getSweepSkipPreview(
      state,
      "The calculated sweep amount is too small to add to this transaction.",
    );
  }

  const usdEquivalent = getAmountUsdValue(
    sweepAmountAtomic,
    input.asset.decimals,
    input.asset.usdPrice,
  );
  const projectedReserveTotalUsd = Number(
    (state.reserve.totalUsdValue + usdEquivalent).toFixed(2),
  );

  return {
    isEnabled: true,
    willSweep: true,
    sweepAssetSymbol: input.asset.symbol,
    sweepAmount: {
      amountAtomic: sweepAmountAtomic.toString(),
      amountDisplay: formatDisplayAmount(
        sweepAmountAtomic,
        input.asset.decimals,
        input.asset.symbol,
      ),
      usdEquivalent: input.asset.usdPrice === null ? null : usdEquivalent,
    },
    projectedReserveTotalUsd,
    thresholdReachedAfterSend:
      projectedReserveTotalUsd >= state.settings.deployThresholdUsd,
    skipReason: null,
  };
}

/**
 * Applies a completed AutoYield sweep to the local reserve snapshot.
 *
 * @param input - Current state, originating asset, preview, and timestamp.
 * @returns Updated reserve balances and derived status.
 */
export function applyAutoYieldSweep(input: {
  readonly asset: SendAssetSummary;
  readonly preview: AutoYieldSweepPreview | null;
  readonly state: AutoYieldState;
  readonly timestampIso: string;
}): AutoYieldState {
  const state = normalizeAutoYieldState(input.state);

  if (input.preview?.willSweep !== true || input.preview.sweepAmount === null) {
    return state;
  }

  const sweepAmountAtomic = BigInt(input.preview.sweepAmount.amountAtomic);
  const nextReserveBalances = upsertReserveBalance({
    amountAtomic: sweepAmountAtomic,
    asset: input.asset,
    reserveBalances: state.reserve.balances,
  });
  const usdEquivalent = input.preview.sweepAmount.usdEquivalent ?? 0;
  const nextState = {
    ...state,
    reserve: {
      ...state.reserve,
      balances: nextReserveBalances,
      totalUsdValue: input.preview.projectedReserveTotalUsd,
      totalSweptUsd: Number((state.reserve.totalSweptUsd + usdEquivalent).toFixed(2)),
      availableToDeploy:
        input.preview.projectedReserveTotalUsd >=
        state.settings.deployThresholdUsd,
      lastSweepAtIso: input.timestampIso,
    },
  };

  return normalizeAutoYieldState(nextState);
}

/**
 * Creates the deploy preview for the current reserve state.
 *
 * @param state - Current AutoYield state.
 * @returns Deploy summary for the manual user-signed deploy action.
 */
export function createAutoYieldDeployPreview(
  state: AutoYieldState,
): AutoYieldDeployPreview {
  const normalizedState = normalizeAutoYieldState(state);
  const sourceAssetSymbols = normalizedState.reserve.balances
    .filter((balance) => BigInt(balance.amountAtomic) > 0n)
    .map((balance) => balance.symbol);

  if (!normalizedState.settings.enabled) {
    return {
      canDeploy: false,
      protocol: normalizedState.settings.activeProtocol,
      amountDisplay: formatStableUsdAmount(0),
      usdEquivalent: 0,
      requiresSwap: false,
      sourceAssetSymbols,
      skipReason: "AutoYield is turned off.",
    };
  }

  if (normalizedState.settings.paused) {
    return {
      canDeploy: false,
      protocol: normalizedState.settings.activeProtocol,
      amountDisplay: formatStableUsdAmount(0),
      usdEquivalent: 0,
      requiresSwap: false,
      sourceAssetSymbols,
      skipReason: "AutoYield is paused.",
    };
  }

  if (
    normalizedState.reserve.totalUsdValue <
    normalizedState.settings.deployThresholdUsd
  ) {
    return {
      canDeploy: false,
      protocol: normalizedState.settings.activeProtocol,
      amountDisplay: formatStableUsdAmount(
        normalizedState.reserve.totalUsdValue,
      ),
      usdEquivalent: normalizedState.reserve.totalUsdValue,
      requiresSwap: false,
      sourceAssetSymbols,
      skipReason:
        "The reserve has not reached the AutoYield deployment threshold yet.",
    };
  }

  const requiresSwap = normalizedState.reserve.balances.some(
    (balance) =>
      balance.assetKind === "native-sol" ||
      balance.mintAddress !== normalizedState.settings.preferredStableMintAddress,
  );

  return {
    canDeploy: true,
    protocol: normalizedState.settings.activeProtocol,
    amountDisplay: formatStableUsdAmount(normalizedState.reserve.totalUsdValue),
    usdEquivalent: normalizedState.reserve.totalUsdValue,
    requiresSwap,
    sourceAssetSymbols,
    skipReason: null,
  };
}

/**
 * Applies a completed deploy action by clearing the reserve and recording totals.
 *
 * @param input - Current state, deploy preview, and completion timestamp.
 * @returns Updated AutoYield state after the deploy is recorded.
 */
export function applyAutoYieldDeploy(input: {
  readonly preview: AutoYieldDeployPreview;
  readonly state: AutoYieldState;
  readonly timestampIso: string;
}): AutoYieldState {
  const state = normalizeAutoYieldState(input.state);

  if (!input.preview.canDeploy) {
    return state;
  }

  const nextState = {
    ...state,
    reserve: {
      ...state.reserve,
      balances: [],
      totalUsdValue: 0,
      totalDeployedUsd: Number(
        (state.reserve.totalDeployedUsd + input.preview.usdEquivalent).toFixed(2),
      ),
      availableToDeploy: false,
      lastDeployAtIso: input.timestampIso,
    },
  };

  return normalizeAutoYieldState(nextState);
}
