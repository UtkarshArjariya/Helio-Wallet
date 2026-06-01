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
 * The fail-closed simulation + two-pass CU sizing + sign-then-send + poll-confirm +
 * per-signing key zeroing all live in the shared {@link createKitTransactionPipeline}
 * (`kit-tx-pipeline.ts`), which the native-staking signer reuses too — one source of
 * truth for the §5 security mandates.
 */

import { helioClient } from "@helio/solana";
import { address, createNoopSigner, type Instruction } from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";

import type { HelioKitRpcReader } from "./kit-rpc";
import {
  createKitTransactionPipeline,
  type KitPipelineOptions,
  type KitSimulationOutcome,
  withSignerFromSecret,
} from "./kit-tx-pipeline";

export type { KitSimulationOutcome } from "./kit-tx-pipeline";

/** Confirmation-poll tuning for the Kit signer (see {@link KitPipelineOptions}). */
export type KitSignerOptions = KitPipelineOptions;

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
  const { signSendConfirm, simulateInstructions } =
    createKitTransactionPipeline(rpc, options);

  return {
    async initializeAutoYield(
      secret,
      stableMint,
      args = KIT_DEFAULT_INIT_ARGS,
    ) {
      return withSignerFromSecret(secret, async (signer) => {
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
      return withSignerFromSecret(secret, async (signer) => {
        const [config] = await helioClient.findConfigPda({
          owner: signer.address,
        });
        return signSendConfirm(signer, [
          helioClient.getPauseAutoYieldInstruction({ owner: signer, config }),
        ]);
      });
    },

    async resumeAutoYield(secret) {
      return withSignerFromSecret(secret, async (signer) => {
        const [config] = await helioClient.findConfigPda({
          owner: signer.address,
        });
        return signSendConfirm(signer, [
          helioClient.getResumeAutoYieldInstruction({ owner: signer, config }),
        ]);
      });
    },

    async updateAutoYieldConfig(secret, args) {
      return withSignerFromSecret(secret, async (signer) => {
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
      return withSignerFromSecret(secret, async (signer) => {
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
      return withSignerFromSecret(secret, async (signer) => {
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
      return withSignerFromSecret(secret, async (signer) => {
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
      return withSignerFromSecret(secret, async (signer) => {
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
      return withSignerFromSecret(secret, async (signer) => {
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
      return simulateInstructions(noop, [ix]);
    },
  };
}
