/**
 * Helio on-chain program client.
 *
 * Handles:
 *  - PDA derivation (owner-scoped addresses)
 *  - Read-only account fetching (no keypair needed)
 *  - Instruction submission (needs keypair from sessionStorage)
 *
 * The program is the helio auto-yield Anchor program deployed at
 * VITE_HELIO_AUTO_YIELD_PROGRAM_ID.
 */

import { AnchorProvider, Program, BN } from '@coral-xyz/anchor'
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'

// ─── IDL (imported from build artefact) ──────────────────────────────────────

// Import the generated IDL JSON. Vite resolves paths from the project root.
// Re-run `anchor build` whenever the program changes to refresh this.
import IDL_JSON from '../../anchor/target/idl/helio.json'

// ─── Program ID ───────────────────────────────────────────────────────────────

export const HELIO_PROGRAM_ID = new PublicKey(
  (import.meta as any).env?.VITE_HELIO_AUTO_YIELD_PROGRAM_ID
    ?? 'Bc5g2hU4NDah3yqvA1zxTeNJkU7zN7NLx7VFhpquNg1u',
)

// ─── PDA seeds (mirrors programs/helio/src/constants.rs) ─────────────────────

const S_CONFIG    = Buffer.from('config')
const S_RESERVE   = Buffer.from('reserve')
const S_SOL_VAULT = Buffer.from('sol-vault')
const S_STABLE    = Buffer.from('vault')
const S_AUTHORITY = Buffer.from('authority')

export interface HelioPdas {
  configPda:    PublicKey
  reservePda:   PublicKey
  solVaultPda:  PublicKey
  authorityPda: PublicKey
  stableVaultPda: (mint: PublicKey) => PublicKey
}

export function deriveHelioAddresses(owner: PublicKey): HelioPdas {
  const pid = HELIO_PROGRAM_ID
  const [configPda]    = PublicKey.findProgramAddressSync([S_CONFIG,    owner.toBuffer()], pid)
  const [reservePda]   = PublicKey.findProgramAddressSync([S_RESERVE,   owner.toBuffer()], pid)
  const [solVaultPda]  = PublicKey.findProgramAddressSync([S_SOL_VAULT, owner.toBuffer()], pid)
  const [authorityPda] = PublicKey.findProgramAddressSync([S_AUTHORITY, owner.toBuffer()], pid)
  const stableVaultPda = (mint: PublicKey) =>
    PublicKey.findProgramAddressSync([S_STABLE, owner.toBuffer(), mint.toBuffer()], pid)[0]
  return { configPda, reservePda, solVaultPda, authorityPda, stableVaultPda }
}

// ─── Keypair storage (sessionStorage — cleared when tab closes) ───────────────

const SECRET_KEY = 'helio:secret'

/** Persist a keypair's secret key for the current browser session. */
export function saveKeypairToSession(keypair: Keypair): void {
  sessionStorage.setItem(SECRET_KEY, JSON.stringify(Array.from(keypair.secretKey)))
}

/** Load the keypair saved for the current session. Returns null if not found. */
export function loadSessionKeypair(): Keypair | null {
  try {
    const raw = sessionStorage.getItem(SECRET_KEY)
    if (!raw) return null
    return Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)))
  } catch {
    return null
  }
}

/** Clear the session keypair (on lock). */
export function clearSessionKeypair(): void {
  sessionStorage.removeItem(SECRET_KEY)
}

// ─── Anchor wallet adapter ────────────────────────────────────────────────────

class KeypairWallet {
  constructor(private keypair: Keypair) {}
  get publicKey() { return this.keypair.publicKey }
  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (tx instanceof Transaction) tx.sign(this.keypair)
    return tx
  }
  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    return txs.map(tx => { if (tx instanceof Transaction) tx.sign(this.keypair); return tx })
  }
}

class ReadOnlyWallet {
  publicKey = PublicKey.default
  async signTransaction<T>(tx: T): Promise<T> { return tx }
  async signAllTransactions<T>(txs: T[]): Promise<T[]> { return txs }
}

function makeProgram(connection: Connection, keypair?: Keypair) {
  const wallet = keypair ? new KeypairWallet(keypair) : new ReadOnlyWallet()
  const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' })
  return new Program(IDL_JSON as any, provider)
}

// ─── On-chain vault state ─────────────────────────────────────────────────────

export interface OnChainVaultState {
  initialized: boolean
  configPda:   PublicKey
  reservePda:  PublicKey
  solVaultPda: PublicKey
  config: {
    enabled: boolean
    paused:  boolean
    sweepMode: number          // 0 = round-up, 1 = percentage
    percentageBps: number
    roundUpUnitLamports: bigint
    deployThresholdAtomic: bigint
    activeProtocol: number
    allowedProtocolsMask: number
    excludedProtocolsMask: number
  } | null
  reserve: {
    solBalanceLamports:       bigint
    stableBalanceAtomic:      bigint
    totalSweptSolLamports:    bigint
    totalSweptStableAtomic:   bigint
    lastSweepUnixTs:          number
    lastWithdrawUnixTs:       number
  } | null
}

export async function fetchOnChainVaultState(
  connection: Connection,
  ownerAddress: string,
): Promise<OnChainVaultState> {
  const owner = new PublicKey(ownerAddress)
  const { configPda, reservePda, solVaultPda } = deriveHelioAddresses(owner)
  const program = makeProgram(connection)

  try {
    const [config, reserve] = await Promise.all([
      (program.account as any).userAutoYieldConfig.fetchNullable(configPda),
      (program.account as any).userReserveState.fetchNullable(reservePda),
    ])

    return {
      initialized: config !== null,
      configPda, reservePda, solVaultPda,
      config: config ? {
        enabled:                config.enabled,
        paused:                 config.paused,
        sweepMode:              config.sweepMode,
        percentageBps:          config.percentageBps,
        roundUpUnitLamports:    BigInt(config.roundUpUnitLamports.toString()),
        deployThresholdAtomic:  BigInt(config.deployThresholdAtomic.toString()),
        activeProtocol:         config.activeProtocol,
        allowedProtocolsMask:   config.allowedProtocolsMask,
        excludedProtocolsMask:  config.excludedProtocolsMask,
      } : null,
      reserve: reserve ? {
        solBalanceLamports:     BigInt(reserve.solBalanceLamports.toString()),
        stableBalanceAtomic:    BigInt(reserve.stableBalanceAtomic.toString()),
        totalSweptSolLamports:  BigInt(reserve.totalSweptSolLamports.toString()),
        totalSweptStableAtomic: BigInt(reserve.totalSweptStableAtomic.toString()),
        lastSweepUnixTs:        Number(reserve.lastSweepUnixTs.toString()),
        lastWithdrawUnixTs:     Number(reserve.lastWithdrawUnixTs.toString()),
      } : null,
    }
  } catch {
    return { initialized: false, configPda, reservePda, solVaultPda, config: null, reserve: null }
  }
}

// ─── Default AutoYield init args ──────────────────────────────────────────────

export const DEFAULT_INIT_ARGS = {
  enabled:               true,
  paused:                false,
  sweepMode:             0,                          // round-up
  roundUpUnitLamports:   new BN(10_000_000),         // 0.01 SOL
  percentageBps:         100,                        // 1%
  deployThresholdAtomic: new BN(1_000_000),          // 1 USDC
  activeProtocol:        0,                          // Kamino
  allowedProtocolsMask:  1,
  excludedProtocolsMask: 0,
}

// ─── Instructions ──────────────────────────────────────────────────────────────

/**
 * Initialize auto-yield config + reserve + vaults for the signer.
 * Must be called once before any sweep/withdraw.
 */
export async function initializeAutoYield(
  connection: Connection,
  keypair: Keypair,
  stableMint: PublicKey,
  args = DEFAULT_INIT_ARGS,
): Promise<string> {
  const program = makeProgram(connection, keypair)
  const owner   = keypair.publicKey
  const { configPda, reservePda, solVaultPda, authorityPda, stableVaultPda } = deriveHelioAddresses(owner)

  return (program.methods as any).initializeAutoYield(args)
    .accounts({
      owner,
      config:           configPda,
      reserveState:     reservePda,
      solVault:         solVaultPda,
      reserveAuthority: authorityPda,
      stableVault:      stableVaultPda(stableMint),
      stableMint,
      tokenProgram:     TOKEN_PROGRAM_ID,
      systemProgram:    SystemProgram.programId,
    })
    .rpc()
}

/** Pause auto-yield sweeps on-chain. */
export async function pauseAutoYield(connection: Connection, keypair: Keypair): Promise<string> {
  const program = makeProgram(connection, keypair)
  const owner   = keypair.publicKey
  const { configPda } = deriveHelioAddresses(owner)
  return (program.methods as any).pauseAutoYield()
    .accounts({ owner, config: configPda })
    .rpc()
}

/** Resume auto-yield sweeps on-chain. */
export async function resumeAutoYield(connection: Connection, keypair: Keypair): Promise<string> {
  const program = makeProgram(connection, keypair)
  const owner   = keypair.publicKey
  const { configPda } = deriveHelioAddresses(owner)
  return (program.methods as any).resumeAutoYield()
    .accounts({ owner, config: configPda })
    .rpc()
}

/** Update the auto-yield config on-chain. */
export async function updateAutoYieldConfig(
  connection: Connection,
  keypair: Keypair,
  args: {
    enabled: boolean; paused: boolean; sweepMode: number
    roundUpUnitLamports: number; percentageBps: number
    deployThresholdAtomic: number; activeProtocol: number
    allowedProtocolsMask: number; excludedProtocolsMask: number
  },
): Promise<string> {
  const program = makeProgram(connection, keypair)
  const owner   = keypair.publicKey
  const { configPda } = deriveHelioAddresses(owner)
  return (program.methods as any).updateAutoYieldConfig({
    ...args,
    roundUpUnitLamports:   new BN(args.roundUpUnitLamports),
    deployThresholdAtomic: new BN(args.deployThresholdAtomic),
  })
    .accounts({ owner, config: configPda })
    .rpc()
}

/**
 * Transfer SOL to a recipient, automatically sweeping `sweepBps` basis points
 * into the sender's personal vault (creates vault on first call).
 */
export async function sendSol(
  connection: Connection,
  keypair: Keypair,
  recipient: PublicKey,
  amountLamports: number,
  sweepBps: number,
): Promise<string> {
  const program = makeProgram(connection, keypair)
  const owner   = keypair.publicKey
  const { solVaultPda } = deriveHelioAddresses(owner)
  return (program.methods as any).sendSol(new BN(amountLamports), sweepBps)
    .accounts({
      owner,
      recipient,
      solVault:      solVaultPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc()
}

/** Sweep SOL directly from the owner's wallet into the auto-yield vault. */
export async function sweepSol(
  connection: Connection,
  keypair: Keypair,
  amountLamports: number,
): Promise<string> {
  const program = makeProgram(connection, keypair)
  const owner   = keypair.publicKey
  const { configPda, reservePda, solVaultPda } = deriveHelioAddresses(owner)
  return (program.methods as any).sweepSol(new BN(amountLamports))
    .accounts({
      owner,
      config:        configPda,
      reserveState:  reservePda,
      solVault:      solVaultPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc()
}

/** Withdraw SOL from the simple vault (no AutoYield config required). */
export async function withdrawVaultSol(
  connection: Connection,
  keypair: Keypair,
  amountLamports: number,
): Promise<string> {
  const program = makeProgram(connection, keypair)
  const owner   = keypair.publicKey
  const { solVaultPda } = deriveHelioAddresses(owner)
  return (program.methods as any).withdrawVaultSol(new BN(amountLamports))
    .accounts({ owner, solVault: solVaultPda })
    .rpc()
}

/** Withdraw SOL from the AutoYield-tracked reserve vault. */
export async function withdrawSol(
  connection: Connection,
  keypair: Keypair,
  amountLamports: number,
): Promise<string> {
  const program = makeProgram(connection, keypair)
  const owner   = keypair.publicKey
  const { configPda, reservePda, solVaultPda } = deriveHelioAddresses(owner)
  return (program.methods as any).withdrawSol(new BN(amountLamports))
    .accounts({
      owner,
      config:       configPda,
      reserveState: reservePda,
      solVault:     solVaultPda,
    })
    .rpc()
}
