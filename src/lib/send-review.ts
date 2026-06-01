/**
 * Smart Transaction Adjustment — live wiring for the send flow.
 *
 * Bridges the wallet's on-chain state to the pure review engine in
 * `@helio/solana` (`analyzeSmartTransactionReview`). It:
 *   1. builds the exact transaction the user is about to send,
 *   2. runs a MANDATORY `simulateTransaction` against the cluster,
 *   3. gathers balance / rent / recent-priority-fee inputs,
 *   4. returns a {@link SmartTransactionReview} describing fees, warnings, and
 *      any amount the engine adjusted to preserve rent-exemption + fees.
 *
 * The SendScreen shows this review BEFORE signing; nothing is signed here.
 */

import type { HelioKitSigner } from '@helio/api';
import {
  analyzeSmartTransactionReview,
  estimatePriorityFeeLamports,
} from '@helio/solana';
import type {
  PriorityFeeSample,
  SmartTransactionAnalysisInput,
  SmartTransactionReview,
  TransactionUrgency,
} from '@helio/types';
import { type Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

/** Fallback min rent for a 0-byte system account (~0.00089 SOL) if RPC fails. */
const RENT_RESERVE_FALLBACK_LAMPORTS = 890_880;
/** Solana base fee: 5000 lamports per signature (single-signer send). */
const BASE_NETWORK_FEE_LAMPORTS = 5_000;

export interface SendReviewParams {
  readonly connection: Connection;
  /** Kit signer — used to build + simulate the exact send tx without signing. */
  readonly kitSigner: HelioKitSigner;
  readonly owner: string;
  readonly recipient: string;
  readonly amountLamports: number;
  /** Vault sweep basis points, or `null` for a plain transfer. */
  readonly sweepBps: number | null;
  readonly solUsdPrice: number | null;
  /** Extra lamports to reserve beyond fees + rent (e.g. vault-creation rent +
   *  the swept fraction on a sweep send) so the adjusted amount is sendable. */
  readonly extraReserveLamports?: number;
}

interface AnalysisInputParams {
  readonly amountLamports: number;
  readonly senderSolBalanceLamports: number;
  readonly rentExemptionReserveLamports: number;
  readonly recentPriorityFeeSamples: readonly PriorityFeeSample[];
  readonly solUsdPrice: number | null;
  readonly simulationWarning: string | null;
}

/**
 * Build the engine input for a native-SOL send. Pure + deterministic so it can
 * be unit-tested without an RPC connection.
 */
export function buildSmartAnalysisInput(
  params: AnalysisInputParams,
): SmartTransactionAnalysisInput {
  const usd =
    params.solUsdPrice !== null
      ? (params.amountLamports / LAMPORTS_PER_SOL) * params.solUsdPrice
      : null;

  return {
    asset: {
      kind: 'native-sol',
      mintAddress: null,
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9,
      iconUrl: null,
      usdPrice: params.solUsdPrice,
    },
    requestedAmount: {
      amountAtomic: String(params.amountLamports),
      amountDisplay: `${(params.amountLamports / LAMPORTS_PER_SOL).toFixed(9).replace(/\.?0+$/, '')} SOL`,
      usdEquivalent: usd,
    },
    senderSolBalanceLamports: params.senderSolBalanceLamports,
    rentExemptionReserveLamports: params.rentExemptionReserveLamports,
    estimatedNetworkFeeLamports: BASE_NETWORK_FEE_LAMPORTS,
    recentPriorityFeeSamples: params.recentPriorityFeeSamples,
    urgency: 'medium',
    requiresAssociatedTokenAccount: false,
    associatedTokenAccountRentLamports: 0,
    simulationWarning: params.simulationWarning,
    wouldLikelyFailFromSlippage: false,
    slippageWarningMessage: null,
  };
}

async function fetchRentReserve(connection: Connection): Promise<number> {
  try {
    return await connection.getMinimumBalanceForRentExemption(0);
  } catch {
    return RENT_RESERVE_FALLBACK_LAMPORTS;
  }
}

async function fetchPriorityFeeSamples(
  connection: Connection,
): Promise<PriorityFeeSample[]> {
  try {
    const fees = await connection.getRecentPrioritizationFees();
    const samples = fees
      .map((f) => ({ slot: f.slot, feeLamports: f.prioritizationFee }))
      .filter((s) => Number.isFinite(s.feeLamports));
    // The engine throws on an empty sample set; seed a zero sample if needed.
    return samples.length > 0 ? samples : [{ slot: 0, feeLamports: 0 }];
  } catch {
    return [{ slot: 0, feeLamports: 0 }];
  }
}

/**
 * Resolve the priority fee PRICE in micro-lamports per compute unit, from
 * recent on-chain prioritization fees.
 *
 * `getRecentPrioritizationFees()` reports `prioritizationFee` as micro-lamports
 * **per compute unit** (a price, not a total lamport budget), so this value is
 * fed directly to `ComputeBudgetProgram.setComputeUnitPrice`. The actual fee
 * paid is `price × computeUnitsConsumed ÷ 1e6` lamports. Returns 0 when no fee
 * data is available (e.g. quiet devnet) so no priority fee is added.
 */
export async function resolvePriorityFeeMicroLamportsPerCu(
  connection: Connection,
  urgency: TransactionUrgency = 'medium',
): Promise<number> {
  const samples = await fetchPriorityFeeSamples(connection);
  try {
    return Math.max(0, estimatePriorityFeeLamports(samples, urgency));
  } catch {
    return 0;
  }
}

/**
 * Produce a Smart Transaction review for a native-SOL send: builds the tx,
 * simulates it, and runs the adjustment engine.
 *
 * @throws {Error} If the recipient is not a valid Solana address.
 */
export async function reviewNativeSolSend(
  params: SendReviewParams,
): Promise<SmartTransactionReview> {
  const owner = new PublicKey(params.owner);
  const { connection } = params;

  const [balanceLamports, rentReserve, prioritySamples] = await Promise.all([
    connection.getBalance(owner).catch(() => 0),
    fetchRentReserve(connection),
    fetchPriorityFeeSamples(connection),
  ]);

  // Mandatory pre-send simulation (fail-closed) via the Kit pipeline: a program
  // rejection OR an RPC failure to simulate both surface as a blocking warning.
  // Builds + simulates the exact tx WITHOUT signing (noop signer).
  const sim = await params.kitSigner.simulateSend(
    params.owner,
    params.recipient,
    params.amountLamports,
    params.sweepBps,
  );

  return analyzeSmartTransactionReview(
    buildSmartAnalysisInput({
      amountLamports: params.amountLamports,
      senderSolBalanceLamports: balanceLamports,
      rentExemptionReserveLamports:
        rentReserve + (params.extraReserveLamports ?? 0),
      recentPriorityFeeSamples: prioritySamples,
      solUsdPrice: params.solUsdPrice,
      simulationWarning: sim.ok ? null : sim.reason,
    }),
  );
}
