/**
 * Kit (web3.js v2) signing pipeline for **native SOL staking** (ADR-0004 Phase 4 —
 * the next v1 island after the AutoYield vault). Replaces the web3.js v1
 * `StakeProgram` build/sign path in `src/lib/staking.ts` + `WalletContext`'s
 * `submitStakeOp`.
 *
 * Like {@link createHelioKitSigner} it is **app-decoupled** (takes the 64-byte
 * session-secret copy + resolved args + a hardened {@link HelioKitRpcReader}) and
 * routes EVERY send through the shared {@link createKitTransactionPipeline}, so the
 * §5 mandates (fail-closed simulation, sign-just-before-send, MV3 poll-confirm,
 * per-signing key zeroing) are enforced identically to the vault path.
 *
 * The owner wallet is both the stake and withdraw authority, so deactivate/withdraw
 * need only the owner's signature; creation additionally needs the fresh, ephemeral
 * stake-account signer — generated here via `generateKeyPairSigner()` (a
 * non-extractable WebCrypto key, never persisted) and co-signed automatically
 * because it is referenced as the `newAccount` signer of the create instruction.
 */

import {
  address,
  generateKeyPairSigner,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit';
import {
  getDeactivateInstruction,
  getDelegateStakeInstruction,
  getInitializeInstruction,
  getWithdrawInstruction,
  STAKE_PROGRAM_ADDRESS,
} from '@solana-program/stake';
import { getCreateAccountInstruction } from '@solana-program/system';

import type { HelioKitRpcReader } from './kit-rpc';
import {
  createKitTransactionPipeline,
  type KitPipelineOptions,
  withSignerFromSecret,
} from './kit-tx-pipeline';

/** StakeStateV2 account size in bytes (matches web3.js `StakeProgram.space`). */
const STAKE_STATE_V2_SPACE = 200n;

/**
 * The legacy stake-config account. The Stake program no longer reads it, but
 * `DelegateStake` still requires the account to be passed (the generated client
 * names it `unused`); web3.js v1 passed the same address.
 */
const STAKE_CONFIG_ADDRESS = address(
  'StakeConfig11111111111111111111111111111111',
);

/** Confirmation-poll tuning for the stake signer (see {@link KitPipelineOptions}). */
export type HelioStakeSignerOptions = KitPipelineOptions;

/** The Kit signing surface for native staking — the replacement for `staking.ts`'s builders. */
export interface HelioStakeSigner {
  /**
   * Create a fresh stake account, fund it with `amountLamports` (+ the rent
   * reserve), and delegate it to `votePubkey`. The owner is set as both stake and
   * withdraw authority.
   *
   * @param secret - The owner's 64-byte session-secret copy (zeroed after signing).
   * @param amountLamports - Lamports to stake (the rent reserve is added on top).
   * @param votePubkey - Base58 validator vote account to delegate to.
   * @returns The confirmed transaction signature.
   * @throws {Error} If simulation blocks the tx, or it fails/does not confirm.
   */
  stakeAndDelegate(
    secret: Uint8Array,
    amountLamports: number,
    votePubkey: string,
  ): Promise<string>;
  /**
   * Deactivate a delegated stake account (owner is the stake authority).
   *
   * @param secret - The owner's 64-byte session-secret copy (zeroed after signing).
   * @param stakeAddress - Base58 stake account to deactivate.
   * @returns The confirmed transaction signature.
   * @throws {Error} If simulation blocks the tx, or it fails/does not confirm.
   */
  deactivateStake(secret: Uint8Array, stakeAddress: string): Promise<string>;
  /**
   * Withdraw lamports from a (deactivated) stake account back to the owner.
   *
   * @param secret - The owner's 64-byte session-secret copy (zeroed after signing).
   * @param stakeAddress - Base58 stake account to withdraw from.
   * @param lamports - Lamports to withdraw to the owner.
   * @returns The confirmed transaction signature.
   * @throws {Error} If simulation blocks the tx, or it fails/does not confirm.
   */
  withdrawStake(
    secret: Uint8Array,
    stakeAddress: string,
    lamports: number,
  ): Promise<string>;
}

/**
 * Creates the native-staking Kit signer bound to a hardened {@link HelioKitRpcReader}.
 *
 * @param rpc - A Kit RPC client built on the rate-limited + scheme-validated transport.
 * @param options - Confirmation-poll tuning (see {@link HelioStakeSignerOptions}).
 * @returns A {@link HelioStakeSigner}.
 */
export function createHelioStakeSigner(
  rpc: HelioKitRpcReader,
  options: HelioStakeSignerOptions = {},
): HelioStakeSigner {
  const { signSendConfirm } = createKitTransactionPipeline(rpc, options);

  return {
    async stakeAndDelegate(secret, amountLamports, votePubkey) {
      return withSignerFromSecret(secret, async (owner) => {
        const stakeAccount: TransactionSigner = await generateKeyPairSigner();
        const rentExempt =
          await rpc.getMinimumBalanceForRentExemption(STAKE_STATE_V2_SPACE);

        const instructions: Instruction[] = [
          // System: allocate + fund the stake account, owned by the Stake program.
          getCreateAccountInstruction({
            payer: owner,
            newAccount: stakeAccount,
            lamports: BigInt(amountLamports) + rentExempt,
            space: STAKE_STATE_V2_SPACE,
            programAddress: STAKE_PROGRAM_ADDRESS,
          }),
          // Stake: initialize authorities (owner = staker + withdrawer) + open lockup.
          getInitializeInstruction({
            stake: stakeAccount.address,
            arg0: { staker: owner.address, withdrawer: owner.address },
            arg1: { unixTimestamp: 0, epoch: 0, custodian: owner.address },
          }),
          // Stake: delegate to the chosen validator vote account.
          getDelegateStakeInstruction({
            stake: stakeAccount.address,
            vote: address(votePubkey),
            unused: STAKE_CONFIG_ADDRESS,
            stakeAuthority: owner,
          }),
        ];
        // signSendConfirm signs with the fee payer (owner) AND every signer
        // referenced in the instructions (the ephemeral stake account).
        return signSendConfirm(owner, instructions);
      });
    },

    async deactivateStake(secret, stakeAddress) {
      return withSignerFromSecret(secret, async (owner) => {
        return signSendConfirm(owner, [
          getDeactivateInstruction({
            stake: address(stakeAddress),
            stakeAuthority: owner,
          }),
        ]);
      });
    },

    async withdrawStake(secret, stakeAddress, lamports) {
      return withSignerFromSecret(secret, async (owner) => {
        return signSendConfirm(owner, [
          getWithdrawInstruction({
            stake: address(stakeAddress),
            recipient: owner.address,
            withdrawAuthority: owner,
            args: BigInt(lamports),
          }),
        ]);
      });
    },
  };
}
