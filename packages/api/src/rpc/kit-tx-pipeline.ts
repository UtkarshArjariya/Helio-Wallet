/**
 * Shared Kit (web3.js v2) transaction pipeline — the single source of truth for
 * Helio's security-critical signing path (ADR-0005 / ADR-0004).
 *
 * Both the vault signer (`helio-kit-signer.ts`) and the native-staking signer
 * (`helio-stake-signer.ts`) compose their instructions and then hand them here.
 * Centralizing this keeps the §5 mandates enforced identically everywhere:
 *
 *  - **Fail-closed simulation before every send** — a program error OR an RPC
 *    failure to simulate both block the send.
 *  - **Two-pass CU sizing** — simulate the unsigned tx, size a ComputeBudget
 *    priority fee from the consumed units, re-simulate the exact final tx.
 *  - **Sign only just before sending** — the tx is signed after both
 *    simulations pass, then submitted + MV3-safe poll-confirmed.
 *  - **Per-signing key zeroing** — {@link withSignerFromSecret} imports the
 *    64-byte secret into a NON-EXTRACTABLE WebCrypto key and zeros the input
 *    byte copy in a `finally`.
 */

import {
  appendTransactionMessageInstructions,
  type Blockhash,
  compileTransaction,
  createKeyPairSignerFromBytes,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  type Instruction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type TransactionSigner,
} from "@solana/kit";
import {
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
} from "@solana-program/compute-budget";

import type { HelioKitRpcReader } from "./kit-rpc";

/** Result of the fail-closed pre-send simulation (mirrors the v1 `SimulationOutcome`). */
export interface KitSimulationOutcome {
  /** `true` = simulated clean. `false` = DO NOT SEND (program error, or RPC could not simulate). */
  readonly ok: boolean;
  /** Human-readable reason when `ok` is false. */
  readonly reason: string | null;
  /** Compute units the simulation consumed (used to size a priority fee). */
  readonly unitsConsumed: number | null;
}

/** Tuning for the confirmation poll (overridable in tests). */
export interface KitPipelineOptions {
  /** Max `getSignatureStatus` polls before giving up. Default 40. */
  readonly confirmPollAttempts?: number;
  /** Delay between polls, ms. Default 500. */
  readonly confirmPollIntervalMs?: number;
}

const DEFAULT_POLL_ATTEMPTS = 40;
const DEFAULT_POLL_INTERVAL_MS = 500;

/** Render a simulation `err` + logs into a short human-readable reason (mirrors v1). */
export function describeSimulationError(
  err: unknown,
  logs: readonly string[] | null,
): string {
  const tail = (logs ?? []).slice(-3).join(" · ");
  const raw = typeof err === "string" ? err : JSON.stringify(err);
  if (raw.includes("InsufficientFundsForRent")) {
    return "Insufficient SOL to keep the account rent-exempt after this transfer.";
  }
  if (/insufficient lamports|InsufficientFunds/i.test(`${raw} ${tail}`)) {
    return "Insufficient SOL to cover the transfer plus fees.";
  }
  return tail ? `${raw} — ${tail}` : raw;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reconstruct a Kit signer from a 64-byte secret, run `fn`, then zero the
 * secret-byte copy. The WebCrypto key is non-extractable (no JS buffer to leak);
 * this only wipes the input copy the caller handed us.
 *
 * @param secret - A 64-byte ed25519 secret-key copy (the caller's session vault keeps its own).
 * @param fn - Receives the reconstructed signer; its result is returned.
 * @returns Whatever `fn` resolves to.
 */
export async function withSignerFromSecret<T>(
  secret: Uint8Array,
  fn: (signer: TransactionSigner) => Promise<T>,
): Promise<T> {
  const signer = await createKeyPairSignerFromBytes(secret);
  try {
    return await fn(signer);
  } finally {
    secret.fill(0);
  }
}

/** The shared pipeline surface bound to a hardened {@link HelioKitRpcReader}. */
export interface KitTransactionPipeline {
  /**
   * Sign → fail-closed simulate → (optional priority-fee CU sizing + re-simulate)
   * → send → poll-confirm. The transaction is signed by EVERY {@link TransactionSigner}
   * referenced in `instructions` plus `feePayer` (so multi-signer txs — e.g. a
   * stake-account creation — just work). Throws if any simulation does not pass.
   *
   * @param feePayer - The fee-payer signer.
   * @param instructions - The instructions to bundle (signer accounts inside them co-sign).
   * @param priorityFeeMicroLamports - Per-CU priority fee; `0` skips the CU-budget pass.
   * @returns The confirmed transaction signature (base58).
   * @throws {Error} If simulation blocks the tx, or it fails/does not confirm on-chain.
   */
  signSendConfirm(
    feePayer: TransactionSigner,
    instructions: readonly Instruction[],
    priorityFeeMicroLamports?: number,
  ): Promise<string>;
  /**
   * Build an UNSIGNED message (fee payer + fresh blockhash + ixs) and simulate it
   * fail-closed — drives review surfaces that must not sign or send.
   *
   * @param feePayer - The fee-payer signer (a noop signer is fine — nothing is sent).
   * @param instructions - The instructions to simulate.
   * @returns The simulation outcome.
   */
  simulateInstructions(
    feePayer: TransactionSigner,
    instructions: readonly Instruction[],
  ): Promise<KitSimulationOutcome>;
}

/**
 * Creates the shared signing pipeline bound to a hardened {@link HelioKitRpcReader}.
 *
 * @param rpc - A Kit RPC client built on the rate-limited + scheme-validated transport.
 * @param options - Confirmation-poll tuning (see {@link KitPipelineOptions}).
 * @returns A {@link KitTransactionPipeline}.
 */
export function createKitTransactionPipeline(
  rpc: HelioKitRpcReader,
  options: KitPipelineOptions = {},
): KitTransactionPipeline {
  const pollAttempts = options.confirmPollAttempts ?? DEFAULT_POLL_ATTEMPTS;
  const pollIntervalMs =
    options.confirmPollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  interface BlockhashLifetime {
    readonly blockhash: string;
    readonly lastValidBlockHeight: bigint;
  }

  /** Assemble an (unsigned) v0 transaction message with the fee payer + blockhash + ixs. */
  function buildMessage(
    signer: TransactionSigner,
    instructions: readonly Instruction[],
    { blockhash, lastValidBlockHeight }: BlockhashLifetime,
  ) {
    return pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(signer, m),
      (m) =>
        setTransactionMessageLifetimeUsingBlockhash(
          { blockhash: blockhash as Blockhash, lastValidBlockHeight },
          m,
        ),
      (m) => appendTransactionMessageInstructions(instructions, m),
    );
  }

  /**
   * Fail-closed simulation of the UNSIGNED, compiled message (the transport sets
   * `replaceRecentBlockhash`, so an unsigned tx with `sigVerify` off simulates
   * cleanly). An RPC failure to simulate returns `ok: false` so callers never send blind.
   */
  async function simulateCompiled(
    message: Parameters<typeof compileTransaction>[0],
  ): Promise<KitSimulationOutcome> {
    try {
      const wire = getBase64EncodedWireTransaction(compileTransaction(message));
      const result = await rpc.simulateTransactionBase64(wire);
      const unitsConsumed =
        result.unitsConsumed != null ? Number(result.unitsConsumed) : null;
      if (result.err) {
        return {
          ok: false,
          reason: describeSimulationError(result.err, result.logs),
          unitsConsumed,
        };
      }
      return { ok: true, reason: null, unitsConsumed };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "RPC error";
      return {
        ok: false,
        reason: `Could not simulate the transaction (${reason}). For your safety it was not sent — please try again.`,
        unitsConsumed: null,
      };
    }
  }

  /** Poll `getSignatureStatus` until confirmed (MV3-safe; no wss subscription). */
  async function confirmBySignature(signature: string): Promise<void> {
    for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
      const status = await rpc.getSignatureStatus(signature);
      if (status) {
        if (status.err) {
          throw new Error(
            `Transaction failed on-chain: ${JSON.stringify(status.err)}`,
          );
        }
        if (
          status.confirmationStatus === "confirmed" ||
          status.confirmationStatus === "finalized"
        ) {
          return;
        }
      }
      if (attempt < pollAttempts - 1) {
        await sleep(pollIntervalMs);
      }
    }
    throw new Error(
      "Transaction was submitted but not confirmed in time. Check the explorer before retrying.",
    );
  }

  async function signSendConfirm(
    signer: TransactionSigner,
    instructions: readonly Instruction[],
    priorityFeeMicroLamports = 0,
  ): Promise<string> {
    const lifetime = await rpc.getLatestBlockhash();

    // Pass 1 — simulate the UNSIGNED tx: gates the send (fail-closed) + sizes the CU budget.
    let message = buildMessage(signer, instructions, lifetime);
    const baseSim = await simulateCompiled(message);
    if (!baseSim.ok) {
      throw new Error(`Simulation blocked this transaction: ${baseSim.reason}`);
    }

    // Pass 2 — add a real ComputeBudget priority fee sized from the simulated usage,
    // then re-simulate the exact final tx (fail-closed).
    if (priorityFeeMicroLamports > 0 && baseSim.unitsConsumed) {
      const unitLimit = Math.ceil(baseSim.unitsConsumed * 1.15) + 450;
      message = buildMessage(
        signer,
        [
          getSetComputeUnitLimitInstruction({ units: unitLimit }),
          getSetComputeUnitPriceInstruction({
            microLamports: BigInt(priorityFeeMicroLamports),
          }),
          ...instructions,
        ],
        lifetime,
      );
      const finalSim = await simulateCompiled(message);
      if (!finalSim.ok) {
        throw new Error(
          `Simulation blocked this transaction: ${finalSim.reason}`,
        );
      }
    }

    // Sign ONLY now — just before the send — then submit + MV3 poll-confirm.
    const signed = await signTransactionMessageWithSigners(message);
    const wire = getBase64EncodedWireTransaction(signed);
    const signature = await rpc.sendTransactionBase64(wire, {
      skipPreflight: true,
    });
    await confirmBySignature(signature);
    return signature;
  }

  async function simulateInstructions(
    signer: TransactionSigner,
    instructions: readonly Instruction[],
  ): Promise<KitSimulationOutcome> {
    const lifetime = await rpc.getLatestBlockhash();
    return simulateCompiled(buildMessage(signer, instructions, lifetime));
  }

  return { signSendConfirm, simulateInstructions };
}
