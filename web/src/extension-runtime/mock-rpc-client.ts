import type { HelioRpcClient } from "@helio/api";
import { analyzeSmartTransactionReview } from "@helio/solana";
import type {
  ActivityItem,
  DappTransactionReview,
  SendAssetSummary,
  SendReviewModel,
  StakeOverviewSnapshot,
  TokenHolding,
  TransactionUrgency,
  WalletAccountSummary,
  WalletDashboardSnapshot,
} from "@helio/types";

import type { ExtensionLocalState } from "./extension-storage";

const DEFAULT_SOL_BALANCE = 402.11;
const SOL_PRICE_USD = 172;
const DEFAULT_ASSOCIATED_TOKEN_ACCOUNT_RENT_LAMPORTS = 2_039_280;
const DEFAULT_TOKEN_HOLDINGS: ReadonlyArray<{
  readonly amount: number;
  readonly decimals: number;
  readonly mintAddress: string;
  readonly name: string;
  readonly symbol: string;
  readonly usdPrice: number;
}> = [
  {
    amount: 21_616.8,
    decimals: 6,
    mintAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    name: "USD Coin",
    symbol: "USDC",
    usdPrice: 1,
  },
  {
    amount: 24_930,
    decimals: 6,
    mintAddress: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    name: "Jupiter",
    symbol: "JUP",
    usdPrice: 1.34,
  },
];

const mockSolBalances = new Map<string, number>();
const mockTokenBalances = new Map<string, Map<string, number>>();

function createShortAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function getSolBalance(address: string): number {
  if (!mockSolBalances.has(address)) {
    mockSolBalances.set(address, DEFAULT_SOL_BALANCE);
  }

  return mockSolBalances.get(address) ?? DEFAULT_SOL_BALANCE;
}

function setSolBalance(address: string, balance: number): void {
  mockSolBalances.set(address, Math.max(balance, 0));
}

function getTokenBalance(address: string, mintAddress: string): number {
  if (!mockTokenBalances.has(address)) {
    mockTokenBalances.set(
      address,
      new Map(
        DEFAULT_TOKEN_HOLDINGS.map((tokenHolding) => [
          tokenHolding.mintAddress,
          tokenHolding.amount,
        ]),
      ),
    );
  }

  return mockTokenBalances.get(address)?.get(mintAddress) ?? 0;
}

function setTokenBalance(
  address: string,
  mintAddress: string,
  balance: number,
): void {
  const walletTokenBalances =
    mockTokenBalances.get(address) ?? new Map<string, number>();

  walletTokenBalances.set(mintAddress, Math.max(balance, 0));
  mockTokenBalances.set(address, walletTokenBalances);
}

/**
 * Resets the in-memory mock balances used by the local RPC fallback.
 */
export function resetMockRpcClientState(): void {
  mockSolBalances.clear();
  mockTokenBalances.clear();
}

function createMockTokenHolding(
  tokenHolding: (typeof DEFAULT_TOKEN_HOLDINGS)[number],
  address: string,
): TokenHolding {
  const amount = getTokenBalance(address, tokenHolding.mintAddress);
  const amountAtomic = Math.round(amount * 10 ** tokenHolding.decimals);

  return {
    assetKind: "spl-token",
    mintAddress: tokenHolding.mintAddress,
    name: tokenHolding.name,
    symbol: tokenHolding.symbol,
    iconUrl: null,
    decimals: tokenHolding.decimals,
    amountAtomic: amountAtomic.toString(),
    amountDisplay: amount.toLocaleString("en-US", {
      maximumFractionDigits: tokenHolding.decimals,
    }),
    usdPrice: tokenHolding.usdPrice,
    usdValue: Number((amount * tokenHolding.usdPrice).toFixed(2)),
    dailyChangePercentage: 0,
    isSpam: false,
  };
}

function createDashboardSnapshot(
  account: WalletAccountSummary,
  activity: readonly ActivityItem[],
  network: WalletDashboardSnapshot["network"]["network"],
): WalletDashboardSnapshot {
  const solBalance = getSolBalance(account.address);
  const tokenRows: readonly TokenHolding[] = [
    {
      assetKind: "native-sol",
      mintAddress: "So11111111111111111111111111111111111111112",
      iconUrl: null,
      symbol: "SOL",
      name: "Solana",
      decimals: 9,
      amountAtomic: Math.round(solBalance * 1_000_000_000).toString(),
      amountDisplay: solBalance.toLocaleString("en-US", {
        maximumFractionDigits: 9,
      }),
      usdPrice: SOL_PRICE_USD,
      usdValue: Number((solBalance * SOL_PRICE_USD).toFixed(2)),
      dailyChangePercentage: 0,
      isSpam: false,
    },
    ...DEFAULT_TOKEN_HOLDINGS.map((tokenHolding) =>
      createMockTokenHolding(tokenHolding, account.address),
    ),
  ];
  const totalUsdValue = Number(
    tokenRows
      .reduce((currentTotal, tokenRow) => currentTotal + tokenRow.usdValue, 0)
      .toFixed(2),
  );

  return {
    account,
    activity,
    network: {
      network,
      endpointLabel: "Local Dev Runtime",
      averageLatencyMs: 24,
      lastHealthyAtIso: new Date().toISOString(),
      isHealthy: true,
    },
    portfolio: {
      totalUsdValue,
      dailyChangePercentage: 0,
      dailyChangeUsd: 0,
      lastUpdatedIso: new Date().toISOString(),
    },
    tokenRows,
  };
}

function createReviewModel(input: {
  readonly asset: SendAssetSummary;
  readonly amountInput: string;
  readonly recipientAddress: string;
  readonly recipientLabel: string | null;
  readonly senderAccount: WalletAccountSummary;
  readonly urgency: TransactionUrgency;
  readonly network: WalletDashboardSnapshot["network"]["network"];
}): SendReviewModel {
  const requestedAmount = Number(input.amountInput);
  const senderSolBalanceLamports = Math.round(
    getSolBalance(input.senderAccount.address) * 1_000_000_000,
  );
  const requestedAmountAtomic = Math.round(
    requestedAmount * 10 ** input.asset.decimals,
  );
  const requiresAssociatedTokenAccount = input.asset.kind === "spl-token";
  const associatedTokenAccountRentLamports = requiresAssociatedTokenAccount
    ? DEFAULT_ASSOCIATED_TOKEN_ACCOUNT_RENT_LAMPORTS
    : 0;

  return {
    network: input.network,
    urgency: input.urgency,
    asset: input.asset,
    recipient: {
      address: input.recipientAddress,
      shortAddress: createShortAddress(input.recipientAddress),
      label: input.recipientLabel,
      isSavedContact: input.recipientLabel !== null,
    },
    review: analyzeSmartTransactionReview({
      asset: input.asset,
      requestedAmount: {
        amountAtomic: requestedAmountAtomic.toString(),
        amountDisplay: `${requestedAmount.toLocaleString("en-US", {
          maximumFractionDigits: input.asset.decimals,
        })} ${input.asset.symbol}`,
        usdEquivalent:
          input.asset.usdPrice === null
            ? null
            : requestedAmount * input.asset.usdPrice,
      },
      senderSolBalanceLamports,
      rentExemptionReserveLamports:
        input.asset.kind === "native-sol" ? 890_880 : 0,
      estimatedNetworkFeeLamports: 5_000,
      recentPriorityFeeSamples: [
        { slot: 1, feeLamports: 1_000 },
        { slot: 2, feeLamports: 2_200 },
        { slot: 3, feeLamports: 3_100 },
      ],
      urgency: input.urgency,
      requiresAssociatedTokenAccount,
      associatedTokenAccountRentLamports,
      simulationWarning: null,
      wouldLikelyFailFromSlippage: false,
      slippageWarningMessage: null,
    }),
  };
}

/**
 * Creates the local fallback RPC client used in tests and non-extension dev.
 *
 * @param localState - Current extension storage state.
 * @returns Deterministic local RPC behavior.
 */
export function createMockRpcClient(
  localState: ExtensionLocalState,
): HelioRpcClient {
  const network = localState.networkPreference.selectedNetwork;

  return {
    async getNetworkStatus() {
      return {
        network,
        endpointLabel: "Local Dev Runtime",
        averageLatencyMs: 24,
        lastHealthyAtIso: new Date().toISOString(),
        isHealthy: true,
      };
    },

    async getSwapQuote(input) {
      const inputAmount = Number(input.inputAmountAtomic);
      const outputAmount = Math.floor(inputAmount * 0.99);

      return {
        inputMintAddress: input.inputMintAddress,
        outputMintAddress: input.outputMintAddress,
        inputAmountAtomic: input.inputAmountAtomic,
        outputAmountAtomic: outputAmount.toString(),
        routeLabel: "Mock route",
        priceImpactPercentage: 0.15,
        slippageBps: input.slippageBps,
      };
    },

    async submitSwap() {
      return {
        signature: `mock-swap-${Date.now()}`,
        status: "confirmed",
        sentAmountDisplay: "Swap submitted",
        recipientShortAddress: "Jupiter",
        explorerLabel: "View on Explorer",
        explorerUrl: null,
      };
    },

    async getStakeOverview(_account) {
      return {
        totalStakedSol: 0,
        positions: [],
      } satisfies StakeOverviewSnapshot;
    },

    async stakeSol(input) {
      return {
        signature: `mock-stake-${Date.now()}`,
        status: "confirmed",
        sentAmountDisplay: `${input.amountInput} SOL staked`,
        recipientShortAddress: createShortAddress(input.validatorVoteAddress),
        explorerLabel: "View on Explorer",
        explorerUrl: null,
      };
    },

    async unstakeSol(input) {
      return {
        signature: `mock-unstake-${Date.now()}`,
        status: "confirmed",
        sentAmountDisplay: "Stake deactivation submitted",
        recipientShortAddress: createShortAddress(input.stakeAccountAddress),
        explorerLabel: "View on Explorer",
        explorerUrl: null,
      };
    },

    async getWalletDashboardSnapshot(account, activity) {
      return createDashboardSnapshot(account, activity, network);
    },

    async reviewSendTransfer(input) {
      return createReviewModel({
        asset: input.asset,
        amountInput: input.amountInput,
        network,
        recipientAddress: input.recipientAddress,
        recipientLabel: input.recipientLabel,
        senderAccount: input.senderAccount,
        urgency: input.urgency,
      });
    },

    async reviewDappTransaction(input) {
      return {
        dapp: {
          iconUrl: input.dapp.iconUrl,
          name: input.dapp.name,
          origin: input.dapp.origin,
          trustLevel: "unknown",
        },
        sendReview: null,
        summaryLines: [
          `Review a transaction requested by ${input.dapp.name}.`,
          `Serialized payload size: ${input.serializedTransactionBase64.length} base64 chars.`,
          `Signer: ${createShortAddress(input.senderAccount.address)}`,
        ],
        warnings: [],
      } satisfies Omit<DappTransactionReview, "requestId">;
    },

    async submitSendTransfer(input) {
      const selectedAmount = input.useAdjustedAmount
        ? input.reviewModel.review.adjustedAmount
        : input.reviewModel.review.originalAmount;
      const senderAddress = localState.vault?.primaryAccount.address ?? "";

      if (input.reviewModel.asset.kind === "native-sol") {
        const currentBalance = getSolBalance(senderAddress);

        setSolBalance(
          senderAddress,
          currentBalance - Number(selectedAmount.amountAtomic) / 1_000_000_000,
        );
      } else if (input.reviewModel.asset.mintAddress !== null) {
        const currentBalance = getTokenBalance(
          senderAddress,
          input.reviewModel.asset.mintAddress,
        );

        setTokenBalance(
          senderAddress,
          input.reviewModel.asset.mintAddress,
          currentBalance -
            Number(selectedAmount.amountAtomic) /
              10 ** input.reviewModel.asset.decimals,
        );
      }

      return {
        signature: `mock-${Date.now()}`,
        status: "confirmed",
        sentAmountDisplay: selectedAmount.amountDisplay,
        recipientShortAddress: input.reviewModel.recipient.shortAddress,
        explorerLabel: "View on Explorer",
        explorerUrl: null,
      };
    },
  };
}
