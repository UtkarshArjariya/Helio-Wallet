/**
 * Native SOL staking — build/list helpers around web3.js `StakeProgram`.
 *
 * Flow: create a stake account + delegate it to a validator vote account, then
 * later deactivate and withdraw. The owner wallet is both the stake and
 * withdraw authority, so deactivate/withdraw need only the owner's signature;
 * creation additionally needs the new (ephemeral) stake-account keypair.
 *
 * All transactions are built unsigned so they go through the same mandatory
 * `simulateTransaction` gate + per-signing key zeroing as the send flow.
 */

import {
  Authorized,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  Lockup,
  PublicKey,
  StakeProgram,
  Transaction,
  type ParsedAccountData,
} from '@solana/web3.js'

/** A sentinel epoch (u64 max) means "not deactivating". */
const MAX_U64 = '18446744073709551615'

export type StakeAccountStatus = 'activating' | 'active' | 'deactivating' | 'inactive'

export interface StakeAccountInfo {
  readonly address: string
  /** Total lamports held by the stake account (stake + rent reserve). */
  readonly lamports: number
  /** Validator vote account this stake is delegated to, if any. */
  readonly voter: string | null
  /** Delegated (active) stake in lamports, 0 when undelegated. */
  readonly delegatedLamports: number
  readonly status: StakeAccountStatus
}

export interface ValidatorInfo {
  readonly votePubkey: string
  readonly commission: number
  readonly activatedStakeSol: number
}

/** Assemble a legacy Transaction with a fresh blockhash + fee payer (unsigned). */
async function assemble(
  connection: Connection,
  feePayer: PublicKey,
  source: Transaction,
): Promise<Transaction> {
  const tx = new Transaction().add(...source.instructions)
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.lastValidBlockHeight = lastValidBlockHeight
  tx.feePayer = feePayer
  return tx
}

function deriveStatus(
  info: { activationEpoch: string; deactivationEpoch: string } | null,
  currentEpoch: number,
): StakeAccountStatus {
  if (info === null) return 'inactive'
  const activation = Number(info.activationEpoch)
  const deactivating = info.deactivationEpoch !== MAX_U64
  if (deactivating) {
    return Number(info.deactivationEpoch) <= currentEpoch ? 'inactive' : 'deactivating'
  }
  return activation < currentEpoch ? 'active' : 'activating'
}

/**
 * List the stake accounts whose stake authority is `ownerAddress`.
 *
 * @param connection - Active Solana connection.
 * @param ownerAddress - Base58 wallet address (the stake authority).
 * @returns The owner's stake accounts with derived activation status.
 * @throws {Error} If the address is not a valid public key.
 */
export async function fetchStakeAccounts(
  connection: Connection,
  ownerAddress: string,
): Promise<StakeAccountInfo[]> {
  const owner = new PublicKey(ownerAddress)
  // Stake authority (`meta.authorized.staker`) sits at byte offset 12 in the
  // StakeStateV2 layout: 4 (enum) + 8 (rent reserve) → 12. The dataSize filter
  // (StakeStateV2 == 200 bytes) narrows the scan so more RPCs accept it.
  const accounts = await connection.getParsedProgramAccounts(StakeProgram.programId, {
    filters: [
      { dataSize: 200 },
      { memcmp: { offset: 12, bytes: owner.toBase58() } },
    ],
  })

  const epochInfo = await connection.getEpochInfo().catch(() => ({ epoch: 0 }))

  return accounts.map(({ pubkey, account }) => {
    const parsed = (account.data as ParsedAccountData).parsed as
      | { type: string; info: any }
      | undefined
    const stake = parsed?.info?.stake ?? null
    const delegation = stake?.delegation ?? null
    return {
      address: pubkey.toBase58(),
      lamports: account.lamports,
      voter: delegation?.voter ?? null,
      delegatedLamports: delegation ? Number(delegation.stake) : 0,
      status: deriveStatus(delegation, epochInfo.epoch),
    }
  })
}

/**
 * Fetch current validators (vote accounts), sorted by activated stake.
 *
 * @param connection - Active Solana connection.
 * @param limit - Max validators to return (highest stake first).
 * @returns Validator vote accounts with commission + activated stake.
 */
export async function fetchValidators(
  connection: Connection,
  limit = 25,
): Promise<ValidatorInfo[]> {
  const { current } = await connection.getVoteAccounts()
  return [...current]
    .sort((a, b) => b.activatedStake - a.activatedStake)
    .slice(0, limit)
    .map((v) => ({
      votePubkey: v.votePubkey,
      commission: v.commission,
      activatedStakeSol: v.activatedStake / LAMPORTS_PER_SOL,
    }))
}

/**
 * Build (unsigned) a create-stake-account + delegate transaction.
 *
 * @param connection - Active Solana connection.
 * @param owner - Wallet that funds + authorizes the stake account.
 * @param stakeAccount - Fresh keypair for the new stake account (must co-sign).
 * @param amountLamports - Lamports to stake (the rent reserve is added on top).
 * @param votePubkey - Validator vote account to delegate to.
 * @returns The assembled, unsigned transaction.
 */
export async function buildStakeAndDelegateTransaction(
  connection: Connection,
  owner: PublicKey,
  stakeAccount: Keypair,
  amountLamports: number,
  votePubkey: PublicKey,
): Promise<Transaction> {
  const rentExempt = await connection.getMinimumBalanceForRentExemption(StakeProgram.space)
  const createTx = StakeProgram.createAccount({
    fromPubkey: owner,
    stakePubkey: stakeAccount.publicKey,
    authorized: new Authorized(owner, owner),
    lockup: new Lockup(0, 0, owner),
    lamports: amountLamports + rentExempt,
  })
  const delegateTx = StakeProgram.delegate({
    stakePubkey: stakeAccount.publicKey,
    authorizedPubkey: owner,
    votePubkey,
  })
  const combined = new Transaction().add(...createTx.instructions, ...delegateTx.instructions)
  return assemble(connection, owner, combined)
}

/** Build (unsigned) a deactivate-stake transaction (owner is the authority). */
export async function buildDeactivateStakeTransaction(
  connection: Connection,
  owner: PublicKey,
  stakePubkey: PublicKey,
): Promise<Transaction> {
  const tx = StakeProgram.deactivate({ stakePubkey, authorizedPubkey: owner })
  return assemble(connection, owner, tx)
}

/** Build (unsigned) a withdraw-from-stake transaction back to the owner. */
export async function buildWithdrawStakeTransaction(
  connection: Connection,
  owner: PublicKey,
  stakePubkey: PublicKey,
  lamports: number,
): Promise<Transaction> {
  const tx = StakeProgram.withdraw({
    stakePubkey,
    authorizedPubkey: owner,
    toPubkey: owner,
    lamports,
  })
  return assemble(connection, owner, tx)
}
