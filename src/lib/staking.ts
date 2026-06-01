/**
 * Native SOL staking — read helpers over the hardened Kit (web3.js v2) RPC.
 *
 * The build/sign path (create + delegate, deactivate, withdraw) now lives in the
 * Kit `HelioStakeSigner` (`@helio/api`), which routes every send through the same
 * fail-closed-simulation + key-zeroing pipeline as the vault + send flows (ADR-0004
 * Phase 4 / ADR-0005). This module keeps only the two reads the staking UI needs:
 * listing the owner's stake accounts and the validator set.
 */

import type { HelioKitRpcReader } from '@helio/api';

const LAMPORTS_PER_SOL = 1_000_000_000;

/** A sentinel epoch (u64 max) means "not deactivating". */
const MAX_U64 = 18446744073709551615n;

export type StakeAccountStatus =
  | 'activating'
  | 'active'
  | 'deactivating'
  | 'inactive';

export interface StakeAccountInfo {
  readonly address: string;
  /** Total lamports held by the stake account (stake + rent reserve). */
  readonly lamports: number;
  /** Validator vote account this stake is delegated to, if any. */
  readonly voter: string | null;
  /** Delegated (active) stake in lamports, 0 when undelegated. */
  readonly delegatedLamports: number;
  readonly status: StakeAccountStatus;
}

export interface ValidatorInfo {
  readonly votePubkey: string;
  readonly commission: number;
  readonly activatedStakeSol: number;
}

function deriveStatus(
  activationEpoch: bigint | null,
  deactivationEpoch: bigint | null,
  currentEpoch: bigint,
): StakeAccountStatus {
  // No delegation on the account → inactive.
  if (activationEpoch === null) return 'inactive';
  const deactivating =
    deactivationEpoch !== null && deactivationEpoch !== MAX_U64;
  if (deactivating) {
    return (deactivationEpoch as bigint) <= currentEpoch
      ? 'inactive'
      : 'deactivating';
  }
  return activationEpoch < currentEpoch ? 'active' : 'activating';
}

/**
 * List the stake accounts whose stake authority is `ownerAddress`.
 *
 * @param rpc - Hardened Kit RPC reader.
 * @param ownerAddress - Base58 wallet address (the stake authority).
 * @returns The owner's stake accounts with derived activation status.
 * @throws {Error} If the address is not a valid public key or the RPC call fails.
 */
export async function fetchStakeAccounts(
  rpc: HelioKitRpcReader,
  ownerAddress: string,
): Promise<StakeAccountInfo[]> {
  const [accounts, currentEpoch] = await Promise.all([
    rpc.getStakeAccountsByStaker(ownerAddress),
    rpc.getCurrentEpoch().catch(() => 0n),
  ]);

  return accounts.map((account) => ({
    address: account.address,
    lamports: Number(account.lamports),
    voter: account.voter,
    delegatedLamports: Number(account.delegatedLamports),
    status: deriveStatus(
      account.activationEpoch,
      account.deactivationEpoch,
      currentEpoch,
    ),
  }));
}

/**
 * Fetch current validators (vote accounts), sorted by activated stake.
 *
 * @param rpc - Hardened Kit RPC reader.
 * @param limit - Max validators to return (highest stake first).
 * @returns Validator vote accounts with commission + activated stake.
 * @throws {Error} If the RPC call fails.
 */
export async function fetchValidators(
  rpc: HelioKitRpcReader,
  limit = 25,
): Promise<ValidatorInfo[]> {
  const current = await rpc.getVoteAccounts();
  return [...current]
    .sort((a, b) =>
      a.activatedStakeLamports < b.activatedStakeLamports
        ? 1
        : a.activatedStakeLamports > b.activatedStakeLamports
          ? -1
          : 0,
    )
    .slice(0, limit)
    .map((vote) => ({
      votePubkey: vote.votePubkey,
      commission: vote.commission,
      activatedStakeSol: Number(vote.activatedStakeLamports) / LAMPORTS_PER_SOL,
    }));
}
