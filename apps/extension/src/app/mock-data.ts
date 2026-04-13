import { analyzeSmartTransactionReview } from "@helio/solana";
import type { DappTransactionReview, SendReviewModel } from "@helio/types";

import type { DappApprovalRequest } from "../features/dapp-approval/dapp-approval.types";
import type { PopupDashboardSnapshot } from "../features/popup-dashboard/popup-dashboard.types";

const SEND_REVIEW_MODEL: SendReviewModel = {
  network: "mainnet-beta",
  asset: {
    kind: "native-sol",
    mintAddress: null,
    name: "Solana",
    symbol: "SOL",
    decimals: 9,
    iconUrl: null,
    usdPrice: 177.21,
  },
  recipient: {
    address: "67sN4CYjR1a3vK5WpfRppGhN3VnWui6cKVXfQePk9n5G",
    shortAddress: "67sN...9n5G",
    label: "Jupiter Swap Router",
    isSavedContact: false,
  },
  urgency: "high",
  review: analyzeSmartTransactionReview({
    asset: {
      kind: "native-sol",
      mintAddress: null,
      name: "Solana",
      symbol: "SOL",
      decimals: 9,
      iconUrl: null,
      usdPrice: 177.21,
    },
    requestedAmount: {
      amountAtomic: "1250000000",
      amountDisplay: "1.25 SOL",
      usdEquivalent: 221.51,
    },
    senderSolBalanceLamports: 1_300_500_000,
    rentExemptionReserveLamports: 890_880,
    estimatedNetworkFeeLamports: 5_000,
    recentPriorityFeeSamples: [
      { slot: 9001, feeLamports: 1_500 },
      { slot: 9002, feeLamports: 2_200 },
      { slot: 9003, feeLamports: 3_100 },
      { slot: 9004, feeLamports: 3_900 },
      { slot: 9005, feeLamports: 5_100 },
    ],
    urgency: "high",
    requiresAssociatedTokenAccount: false,
    associatedTokenAccountRentLamports: 0,
    simulationWarning: null,
    wouldLikelyFailFromSlippage: false,
    slippageWarningMessage: null,
  }),
};

export const DASHBOARD_SNAPSHOT: PopupDashboardSnapshot = {
  account: {
    address: "4nJ6At5m8H9LgVVahWk4bgTLr5VKR3kpgvJtBy5JApd9",
    label: "Primary Vault",
    derivationIndex: 0,
    kind: "derived",
    shortAddress: "4nJ6...Apd9",
  },
  portfolio: {
    totalUsdValue: 126404.82,
    dailyChangeUsd: 4187.33,
    dailyChangePercentage: 3.42,
    lastUpdatedIso: "2026-04-13T15:01:00.000Z",
  },
  network: {
    network: "mainnet-beta",
    endpointLabel: "Helius Prime",
    averageLatencyMs: 124,
    lastHealthyAtIso: "2026-04-13T15:01:02.000Z",
    isHealthy: true,
  },
  tokenRows: [
    {
      mintAddress: "So11111111111111111111111111111111111111112",
      iconUrl: null,
      symbol: "SOL",
      name: "Solana",
      amountDisplay: "402.11",
      usdValue: 71272.91,
      dailyChangePercentage: 4.2,
      isSpam: false,
    },
    {
      mintAddress: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
      iconUrl: null,
      symbol: "JUP",
      name: "Jupiter",
      amountDisplay: "24,930.00",
      usdValue: 33515.11,
      dailyChangePercentage: 2.11,
      isSpam: false,
    },
    {
      mintAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      iconUrl: null,
      symbol: "USDC",
      name: "USD Coin",
      amountDisplay: "21,616.80",
      usdValue: 21616.8,
      dailyChangePercentage: 0,
      isSpam: false,
    },
  ],
  activity: [
    {
      id: "activity-1",
      kind: "swap",
      title: "Swapped SOL to USDC",
      subtitle: "Jupiter route via Orca",
      amountDisplay: "1.25 SOL",
      status: "confirmed",
      timestampIso: "2026-04-13T14:57:00.000Z",
      explorerUrl: null,
    },
    {
      id: "activity-2",
      kind: "receive",
      title: "Received SOL",
      subtitle: "From 2vA8...Rj7P",
      amountDisplay: "10 SOL",
      status: "pending",
      timestampIso: "2026-04-13T14:43:00.000Z",
      explorerUrl: null,
    },
  ],
};

export const APPROVAL_REQUEST: DappApprovalRequest = {
  requestId: "dapp-request-1",
  dapp: {
    name: "Meteora Pro",
    origin: "https://app.meteora.ag",
    iconUrl: null,
    trustLevel: "verified",
  },
  summaryLines: [
    "Connect wallet address and read balances.",
    "Request a signature for a SOL swap transaction.",
    "Priority fee included for faster confirmation.",
  ],
  warnings: [
    {
      code: "authority-change",
      title: "Authority change detected",
      message:
        "This request updates a delegation authority for a strategy account.",
      severity: "critical",
    },
  ],
  sendReview: SEND_REVIEW_MODEL,
} satisfies DappTransactionReview;
