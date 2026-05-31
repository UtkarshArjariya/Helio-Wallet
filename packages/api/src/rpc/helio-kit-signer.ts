/**
 * Kit (web3.js v2) signing pipeline for the Helio AutoYield program
 * (ADR-0005 Stage 1b). Replaces the Anchor v1 `.rpc()` / `.instruction()` signing
 * in `src/lib/helio-program.ts` for the 8 vault instructions + the plain-SOL send.
 *
 * It is **app-decoupled**: every method takes the 64-byte session secret (a copy —
 * the caller's session vault keeps its own) plus already-resolved arguments, and a
 * {@link HelioKitRpcReader} (built on the hardened transport). So it lives in the
 * runtime layer, is unit-testable against a mock RPC, and needs no `@solana/kit`
 * dependency in the app tree.
 *
 * Security mandates (CLAUDE.md §5), preserved/strengthened:
 *  - **Fail-closed simulation before every send** — a program error OR an RPC failure
 *    to simulate both block the send. (Stronger than the v1 vault `.rpc()` path, which
 *    did not pre-simulate.)
 *  - **Per-signing key zeroing** — the secret is imported via
 *    `createKeyPairSignerFromBytes` into a NON-EXTRACTABLE WebCrypto Ed25519 key (no JS
 *    buffer to leak), and the input byte copy is zeroed in a `finally`.
 *  - **MV3-safe confirmation** — polls `getSignatureStatus` (subscriptions need a
 *    `wss://` endpoint MV3 service workers idle-suspend).
 */

import { helioClient } from "@helio/solana";
import {
  address,
  appendTransactionMessageInstructions,
  type Blockhash,
  compileTransaction,
  createKeyPairSignerFromBytes,
  createNoopSigner,
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
import { getTransferSolInstruction } from "@solana-program/system";

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

/** The AutoYield config struct (`AutoYieldConfigArgs`), in Kit (`bigint`) form. */
export interface KitAutoYieldConfigArgs {
  readonly enabled: boolean;
  readonly paused: boolean;
  readonly sweepMode: number;
  readonly roundUpUnitLamports: bigint;
  readonly percentageBps: number;
  readonly deployThresholdAtomic: bigint;
  readonly activeProtocol: number;
  readonly allowedProtocolsMask: number;
  readonly excludedProtocolsMask: number;
}

/** Default init args (mirrors `DEFAULT_INIT_ARGS` in `src/lib/helio-program.ts`). */
export const KIT_DEFAULT_INIT_ARGS: KitAutoYieldConfigArgs = {
  enabled: true,
  paused: false,
  sweepMode: 0, // round-up
  roundUpUnitLamports: 10_000_000n, // 0.01 SOL
  percentageBps: 100, // 1%
  deployThresholdAtomic: 1_000_000n, // 1 USDC
  activeProtocol: 0, // Kamino
  allowedProtocolsMask: 1,
  excludedProtocolsMask: 0,
};

/** Tuning for the confirmation poll (overridable in tests). */
export interface KitSignerOptions {
  /** Max `getSignatureStatus` polls before giving up. Default 40. */
  readonly confirmPollAttempts?: number;
  /** Delay between polls, ms. Default 500. */
  readonly confirmPollIntervalMs?: number;
}

const DEFAULT_POLL_ATTEMPTS = 40;
const DEFAULT_POLL_INTERVAL_MS = 500;

/** The Kit signing surface — the Kit replacement for `helio-program.ts`'s signers. */
export interface HelioKitSigner {
  initializeAutoYield(
    secret: Uint8Array,
    stableMint: string,
    args?: KitAutoYieldConfigArgs,
  ): Promise<string>;
  pauseAutoYield(secret: Uint8Array): Promise<string>;
  resumeAutoYield(secret: Uint8Array): Promise<string>;
  updateAutoYieldConfig(
    secret: Uint8Array,
    args: KitAutoYieldConfigArgs,
  ): Promise<string>;
  sweepSol(secret: Uint8Array, amountLamports: number): Promise<string>;
  withdrawVaultSol(secret: Uint8Array, amountLamports: number): Promise<string>;
  withdrawSol(secret: Uint8Array, amountLamports: number): Promise<string>;
  sendSol(
    secret: Uint8Array,
    recipient: string,
    amountLamports: number,
    sweepBps: number,
    priorityFeeMicroLamports?: number,
  ): Promise<string>;
  sendSolPlain(
    secret: Uint8Array,
    recipient: string,
    amountLamports: number,
    priorityFeeMicroLamports?: number,
  ): Promise<string>;
  /**
   * Build + simulate a SOL send WITHOUT signing or sending (drives the Smart
   * Adjustment review). `sweepBps === null` → plain transfer; otherwise vault sweep.
   */
  simulateSend(
    feePayer: string,
    recipient: string,
    amountLamports: number,
    sweepBps: number | null,
  ): Promise<KitSimulationOutcome>;
}

/** Render a simulation `err` + logs into a short human-readable reason (mirrors v1). */
function describeSimulationError(
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
 * Creates the Kit signer bound to a hardened {@link HelioKitRpcReader}.
 *
 * @param rpc - A Kit RPC client built on the rate-limited + scheme-validated transport.
 * @param options - Confirmation-poll tuning (see {@link KitSignerOptions}).
 * @returns A {@link HelioKitSigner}.
 */
export function createHelioKitSigner(
  rpc: HelioKitRpcReader,
  options: KitSignerOptions = {},
): HelioKitSigner {
  const pollAttempts = options.confirmPollAttempts ?? DEFAULT_POLL_ATTEMPTS;
  const pollIntervalMs =
    options.confirmPollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  /** A blockhash lifetime, fetched once and reused for sim + the final signed send. */
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
   * cleanly — and signing is deferred until just before the send). An RPC failure
   * to simulate returns `ok: false` so callers never send blind.
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

  /**
   * Sign → fail-closed simulate → (optional priority-fee CU sizing + re-simulate) →
   * send → poll-confirm. Throws if any simulation does not pass.
   */
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

  /** Reconstruct the signer, run `fn`, then zero the secret-byte copy. */
  async function withSigner<T>(
    secret: Uint8Array,
    fn: (signer: TransactionSigner) => Promise<T>,
  ): Promise<T> {
    const signer = await createKeyPairSignerFromBytes(secret);
    try {
      return await fn(signer);
    } finally {
      // The WebCrypto key is non-extractable (no JS buffer); zero the input copy.
      secret.fill(0);
    }
  }

  return {
    async initializeAutoYield(
      secret,
      stableMint,
      args = KIT_DEFAULT_INIT_ARGS,
    ) {
      return withSigner(secret, async (signer) => {
        const owner = signer.address;
        const mint = address(stableMint);
        const [
          [config],
          [reserveState],
          [reserveAuthority],
          [solVault],
          [stableVault],
        ] = await Promise.all([
          helioClient.findConfigPda({ owner }),
          helioClient.findReserveStatePda({ owner }),
          helioClient.findReserveAuthorityPda({ owner }),
          helioClient.findSolVaultPda({ owner }),
          helioClient.findStableVaultPda({ owner, stableMint: mint }),
        ]);
        const ix = helioClient.getInitializeAutoYieldInstruction({
          owner: signer,
          config,
          reserveState,
          solVault,
          reserveAuthority,
          stableVault,
          stableMint: mint,
          args,
        });
        return signSendConfirm(signer, [ix]);
      });
    },

    async pauseAutoYield(secret) {
      return withSigner(secret, async (signer) => {
        const [config] = await helioClient.findConfigPda({
          owner: signer.address,
        });
        return signSendConfirm(signer, [
          helioClient.getPauseAutoYieldInstruction({ owner: signer, config }),
        ]);
      });
    },

    async resumeAutoYield(secret) {
      return withSigner(secret, async (signer) => {
        const [config] = await helioClient.findConfigPda({
          owner: signer.address,
        });
        return signSendConfirm(signer, [
          helioClient.getResumeAutoYieldInstruction({ owner: signer, config }),
        ]);
      });
    },

    async updateAutoYieldConfig(secret, args) {
      return withSigner(secret, async (signer) => {
        const [config] = await helioClient.findConfigPda({
          owner: signer.address,
        });
        return signSendConfirm(signer, [
          helioClient.getUpdateAutoYieldConfigInstruction({
            owner: signer,
            config,
            args,
          }),
        ]);
      });
    },

    async sweepSol(secret, amountLamports) {
      return withSigner(secret, async (signer) => {
        const owner = signer.address;
        const [[config], [reserveState], [solVault]] = await Promise.all([
          helioClient.findConfigPda({ owner }),
          helioClient.findReserveStatePda({ owner }),
          helioClient.findSolVaultPda({ owner }),
        ]);
        return signSendConfirm(signer, [
          helioClient.getSweepSolInstruction({
            owner: signer,
            config,
            reserveState,
            solVault,
            amountLamports,
          }),
        ]);
      });
    },

    async withdrawVaultSol(secret, amountLamports) {
      return withSigner(secret, async (signer) => {
        const [solVault] = await helioClient.findSolVaultPda({
          owner: signer.address,
        });
        return signSendConfirm(signer, [
          helioClient.getWithdrawVaultSolInstruction({
            owner: signer,
            solVault,
            amountLamports,
          }),
        ]);
      });
    },

    async withdrawSol(secret, amountLamports) {
      return withSigner(secret, async (signer) => {
        const owner = signer.address;
        const [[config], [reserveState], [solVault]] = await Promise.all([
          helioClient.findConfigPda({ owner }),
          helioClient.findReserveStatePda({ owner }),
          helioClient.findSolVaultPda({ owner }),
        ]);
        return signSendConfirm(signer, [
          helioClient.getWithdrawSolInstruction({
            owner: signer,
            config,
            reserveState,
            solVault,
            amountLamports,
          }),
        ]);
      });
    },

    async sendSol(
      secret,
      recipient,
      amountLamports,
      sweepBps,
      priorityFeeMicroLamports = 0,
    ) {
      return withSigner(secret, async (signer) => {
        const [solVault] = await helioClient.findSolVaultPda({
          owner: signer.address,
        });
        return signSendConfirm(
          signer,
          [
            helioClient.getSendSolInstruction({
              owner: signer,
              recipient: address(recipient),
              solVault,
              amountLamports,
              sweepBps,
            }),
          ],
          priorityFeeMicroLamports,
        );
      });
    },

    async sendSolPlain(
      secret,
      recipient,
      amountLamports,
      priorityFeeMicroLamports = 0,
    ) {
      return withSigner(secret, async (signer) => {
        return signSendConfirm(
          signer,
          [
            getTransferSolInstruction({
              source: signer,
              destination: address(recipient),
              amount: BigInt(amountLamports),
            }),
          ],
          priorityFeeMicroLamports,
        );
      });
    },

    async simulateSend(feePayer, recipient, amountLamports, sweepBps) {
      const owner = address(feePayer);
      const noop = createNoopSigner(owner);
      let ix: Instruction;
      if (sweepBps === null) {
        ix = getTransferSolInstruction({
          source: noop,
          destination: address(recipient),
          amount: BigInt(amountLamports),
        });
      } else {
        const [solVault] = await helioClient.findSolVaultPda({ owner });
        ix = helioClient.getSendSolInstruction({
          owner: noop,
          recipient: address(recipient),
          solVault,
          amountLamports,
          sweepBps,
        });
      }
      const lifetime = await rpc.getLatestBlockhash();
      return simulateCompiled(buildMessage(noop, [ix], lifetime));
    },
  };
}
