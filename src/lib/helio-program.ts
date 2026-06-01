/**
 * Helio on-chain helpers (web3.js v1 residuals after ADR-0005).
 *
 * The vault SIGNING path moved to the Kit pipeline (`@helio/api`
 * `helio-kit-signer.ts`) — this module no longer depends on `@coral-xyz/anchor`.
 * It now holds only:
 *  - PDA derivation + program id + stable-mint resolution (pure),
 *  - the on-chain vault-state read, decoded via the Codama-generated account
 *    decoders over the hardened Kit RPC (`fetchOnChainVaultState`),
 *  - BIP-39 / keypair / session / onboarding helpers,
 *  - the v1 simulate + multi-signer send helpers that NATIVE STAKING and the
 *    Jupiter SWAP path still use (`simulateSendTransaction`,
 *    `signSendAndConfirmWith`, `zeroKeypairSecret`).
 */

import type { HelioKitRpcReader } from '@helio/api';
import { helioClient } from '@helio/solana';
import { getBase64Encoder } from '@solana/kit';
import {
  type Connection,
  Keypair,
  PublicKey,
  type Transaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

// ─── Program ID ───────────────────────────────────────────────────────────────

export const HELIO_PROGRAM_ID = new PublicKey(
  (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_HELIO_AUTO_YIELD_PROGRAM_ID ??
    'EJw2Y8jJwbw1CeHRDRHSeUYzU2L1ke1aqmkQLod5T151',
);

// ─── PDA seeds (mirrors programs/helio/src/constants.rs) ─────────────────────

const S_CONFIG = Buffer.from('config');
const S_RESERVE = Buffer.from('reserve');
const S_SOL_VAULT = Buffer.from('sol-vault');
const S_STABLE = Buffer.from('vault');
const S_AUTHORITY = Buffer.from('authority');

export interface HelioPdas {
  configPda: PublicKey;
  reservePda: PublicKey;
  solVaultPda: PublicKey;
  authorityPda: PublicKey;
  stableVaultPda: (mint: PublicKey) => PublicKey;
}

export function deriveHelioAddresses(owner: PublicKey): HelioPdas {
  const pid = HELIO_PROGRAM_ID;
  const [configPda] = PublicKey.findProgramAddressSync(
    [S_CONFIG, owner.toBuffer()],
    pid,
  );
  const [reservePda] = PublicKey.findProgramAddressSync(
    [S_RESERVE, owner.toBuffer()],
    pid,
  );
  const [solVaultPda] = PublicKey.findProgramAddressSync(
    [S_SOL_VAULT, owner.toBuffer()],
    pid,
  );
  const [authorityPda] = PublicKey.findProgramAddressSync(
    [S_AUTHORITY, owner.toBuffer()],
    pid,
  );
  const stableVaultPda = (mint: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [S_STABLE, owner.toBuffer(), mint.toBuffer()],
      pid,
    )[0];
  return { configPda, reservePda, solVaultPda, authorityPda, stableVaultPda };
}

// ─── BIP-39 mnemonic ──────────────────────────────────────────────────────────

import { hmac } from '@noble/hashes/hmac.js';
import { sha512 } from '@noble/hashes/sha2.js';
import {
  generateMnemonic,
  mnemonicToSeedSync,
  validateMnemonic,
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

// Phantom-compatible derivation path: m/44'/501'/0'/0'
const SOLANA_DERIVATION_INDEXES = [44, 501, 0, 0];
const HARDENED_OFFSET = 0x80000000;
const ED25519_CURVE = new TextEncoder().encode('ed25519 seed');

/** SLIP-10 master key from seed. */
function masterKey(seed: Uint8Array): {
  key: Uint8Array;
  chainCode: Uint8Array;
} {
  const I = hmac(sha512, ED25519_CURVE, seed);
  return { key: I.slice(0, 32), chainCode: I.slice(32) };
}

/** SLIP-10 hardened child key derivation. */
function ckdPriv(
  parent: { key: Uint8Array; chainCode: Uint8Array },
  index: number,
): { key: Uint8Array; chainCode: Uint8Array } {
  // data = 0x00 || key (32) || ser32(index)
  const data = new Uint8Array(1 + 32 + 4);
  data[0] = 0;
  data.set(parent.key, 1);
  // Big-endian uint32
  const i = index >>> 0;
  data[33] = (i >>> 24) & 0xff;
  data[34] = (i >>> 16) & 0xff;
  data[35] = (i >>> 8) & 0xff;
  data[36] = i & 0xff;
  const I = hmac(sha512, parent.chainCode, data);
  return { key: I.slice(0, 32), chainCode: I.slice(32) };
}

/** Generate a fresh 12-word BIP-39 recovery phrase. */
export function generateRecoveryPhrase(): string {
  return generateMnemonic(wordlist, 128); // 128 bits = 12 words
}

/** Check whether a phrase is a valid BIP-39 12/24-word mnemonic. */
export function isValidPhrase(phrase: string): boolean {
  return validateMnemonic(phrase.trim().toLowerCase(), wordlist);
}

/**
 * Decode a base58-encoded Solana secret key into a Keypair.
 *
 * Accepts the format Phantom (and our own ExportPrivateKeyScreen) produces:
 * the full 64-byte ed25519 secret key as base58. Whitespace is tolerated; an
 * uncommon 32-byte seed is also accepted via `fromSeed`.
 *
 * @throws Error with a user-friendly message on invalid input.
 */
export function keypairFromBase58(input: string): Keypair {
  const cleaned = input.trim().replace(/\s+/g, '');
  if (cleaned.length === 0) {
    throw new Error('Private key is empty.');
  }
  // bs58 is already a workspace dep — same encoding the export screen uses.
  let bytes: Uint8Array;
  try {
    bytes = bs58.decode(cleaned);
  } catch {
    throw new Error("That doesn't look like a base58 private key.");
  }
  if (bytes.length === 64) return Keypair.fromSecretKey(bytes);
  if (bytes.length === 32) return Keypair.fromSeed(bytes);
  throw new Error(
    `Expected 64-byte (full secret key) or 32-byte (seed) input — got ${bytes.length} bytes.`,
  );
}

/** Derive a Solana keypair from a BIP-39 recovery phrase (Phantom-compatible). */
export function keypairFromPhrase(phrase: string): Keypair {
  const normalized = phrase.trim().toLowerCase();
  if (!validateMnemonic(normalized, wordlist)) {
    throw new Error('Invalid recovery phrase');
  }
  const seed = mnemonicToSeedSync(normalized);
  let node = masterKey(seed);
  for (const idx of SOLANA_DERIVATION_INDEXES) {
    node = ckdPriv(node, idx + HARDENED_OFFSET);
  }
  return Keypair.fromSeed(node.key);
}

// ─── Onboarding scratchpad (sessionStorage — ephemeral) ───────────────────────

const ONBOARDING_MODE = 'helio:onboarding-mode';
const PENDING_PHRASE = 'helio:pending-phrase';
const PENDING_SECRET_B58 = 'helio:pending-secret-b58';

export type OnboardingMode = 'create' | 'import' | 'import-key';

export function setOnboardingMode(mode: OnboardingMode): void {
  sessionStorage.setItem(ONBOARDING_MODE, mode);
}
export function getOnboardingMode(): OnboardingMode | null {
  const v = sessionStorage.getItem(ONBOARDING_MODE);
  return v === 'create' || v === 'import' || v === 'import-key' ? v : null;
}
export function clearOnboardingMode(): void {
  sessionStorage.removeItem(ONBOARDING_MODE);
}

export function setPendingPhrase(phrase: string): void {
  sessionStorage.setItem(PENDING_PHRASE, phrase);
}
export function getPendingPhrase(): string | null {
  return sessionStorage.getItem(PENDING_PHRASE);
}
export function clearPendingPhrase(): void {
  sessionStorage.removeItem(PENDING_PHRASE);
}

/** Stash a base58-encoded Solana secret key for the create-password handoff. */
export function setPendingSecretKeyBase58(b58: string): void {
  sessionStorage.setItem(PENDING_SECRET_B58, b58);
}
export function getPendingSecretKeyBase58(): string | null {
  return sessionStorage.getItem(PENDING_SECRET_B58);
}
export function clearPendingSecretKey(): void {
  sessionStorage.removeItem(PENDING_SECRET_B58);
}

// ─── Keypair storage ──────────────────────────────────────────────────────────
//
// In an extension context we route through `chrome.storage.session` (in-memory,
// extension-scoped, survives popup open/close) via the cached secret-store. In
// a plain web context (Vite dev / Vercel) it falls back to `sessionStorage`.
//
// `hydrateSecretCache()` is awaited in main.tsx before render, so the
// synchronous load below is safe to call from `useState` initialisers and
// router boot logic.

import { clearSecret, loadSecret, saveSecret } from './secret-store';

/** Persist a keypair's secret key for the current browser session. */
export function saveKeypairToSession(keypair: Keypair): void {
  saveSecret(keypair.secretKey);
}

/** Load the keypair saved for the current session. Returns null if not found. */
export function loadSessionKeypair(): Keypair | null {
  const sec = loadSecret();
  if (!sec) return null;
  try {
    return Keypair.fromSecretKey(sec);
  } catch {
    return null;
  }
}

/** Clear the session keypair (on lock). */
export function clearSessionKeypair(): void {
  clearSecret();
}

// ─── On-chain vault state ─────────────────────────────────────────────────────

export interface OnChainVaultState {
  initialized: boolean;
  configPda: PublicKey;
  reservePda: PublicKey;
  solVaultPda: PublicKey;
  config: {
    enabled: boolean;
    paused: boolean;
    sweepMode: number; // 0 = round-up, 1 = percentage
    percentageBps: number;
    roundUpUnitLamports: bigint;
    deployThresholdAtomic: bigint;
    activeProtocol: number;
    allowedProtocolsMask: number;
    excludedProtocolsMask: number;
  } | null;
  reserve: {
    solBalanceLamports: bigint;
    stableBalanceAtomic: bigint;
    totalSweptSolLamports: bigint;
    totalSweptStableAtomic: bigint;
    lastSweepUnixTs: number;
    lastWithdrawUnixTs: number;
  } | null;
}

export async function fetchOnChainVaultState(
  rpc: HelioKitRpcReader,
  ownerAddress: string,
): Promise<OnChainVaultState> {
  const owner = new PublicKey(ownerAddress);
  const { configPda, reservePda, solVaultPda } = deriveHelioAddresses(owner);

  try {
    const [configInfo, reserveInfo] = await Promise.all([
      rpc.getAccountInfo(configPda.toBase58()),
      rpc.getAccountInfo(reservePda.toBase58()),
    ]);
    // `getAccountInfo` returns base64 account data; decode it with the
    // Codama-generated account decoders (ADR-0005 — replaces the Anchor read,
    // so this module no longer depends on `@coral-xyz/anchor`).
    const base64 = getBase64Encoder();
    const config = configInfo
      ? helioClient
          .getUserAutoYieldConfigDecoder()
          .decode(base64.encode(configInfo.data))
      : null;
    const reserve = reserveInfo
      ? helioClient
          .getUserReserveStateDecoder()
          .decode(base64.encode(reserveInfo.data))
      : null;

    return {
      initialized: config !== null,
      configPda,
      reservePda,
      solVaultPda,
      config: config
        ? {
            enabled: config.enabled,
            paused: config.paused,
            sweepMode: config.sweepMode,
            percentageBps: config.percentageBps,
            roundUpUnitLamports: config.roundUpUnitLamports,
            deployThresholdAtomic: config.deployThresholdAtomic,
            activeProtocol: config.activeProtocol,
            allowedProtocolsMask: config.allowedProtocolsMask,
            excludedProtocolsMask: config.excludedProtocolsMask,
          }
        : null,
      reserve: reserve
        ? {
            solBalanceLamports: reserve.solBalanceLamports,
            stableBalanceAtomic: reserve.stableBalanceAtomic,
            totalSweptSolLamports: reserve.totalSweptSolLamports,
            totalSweptStableAtomic: reserve.totalSweptStableAtomic,
            lastSweepUnixTs: Number(reserve.lastSweepUnixTs),
            lastWithdrawUnixTs: Number(reserve.lastWithdrawUnixTs),
          }
        : null,
    };
  } catch {
    return {
      initialized: false,
      configPda,
      reservePda,
      solVaultPda,
      config: null,
      reserve: null,
    };
  }
}

// ─── Stable mint per cluster ──────────────────────────────────────────────────

/** Circle USDC — mainnet vs devnet. The on-chain program validates the mint
 *  account exists, so a mainnet pubkey on devnet will fail at init. */
export const USDC_MINT = {
  mainnet: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  devnet: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
} as const;

/** Resolve the cluster's USDC mint from an active Connection. Inspects the RPC
 *  URL — falls back to devnet because that's where the program is deployed. */
export function resolveStableMint(connection: Connection): PublicKey {
  const url = connection.rpcEndpoint.toLowerCase();
  if (url.includes('mainnet')) return USDC_MINT.mainnet;
  return USDC_MINT.devnet;
}

// ─── Simulate + multi-signer send helpers (web3.js v1) ───────────────────────
//
// The vault SIGNING path moved to the Kit pipeline (ADR-0005). The helpers below
// remain on web3.js v1 because NATIVE STAKING (`StakeProgram`) and the Jupiter
// SWAP path still build/sign v1 `Transaction`s; they are NOT Anchor.

/** Render a simulation `err` + logs into a short human-readable reason. */
function describeSimulationError(
  err: unknown,
  logs: readonly string[] | null,
): string {
  const tail = (logs ?? []).slice(-3).join(' · ');
  const raw = typeof err === 'string' ? err : JSON.stringify(err);
  if (raw.includes('InsufficientFundsForRent')) {
    return 'Insufficient SOL to keep the account rent-exempt after this transfer.';
  }
  if (/insufficient lamports|InsufficientFunds/i.test(`${raw} ${tail}`)) {
    return 'Insufficient SOL to cover the transfer plus fees.';
  }
  return tail ? `${raw} — ${tail}` : raw;
}

export interface SimulationOutcome {
  /** `true` = simulation ran clean. `false` = DO NOT SEND — either the program
   *  rejected the tx, or the cluster could not be reached to simulate. */
  readonly ok: boolean;
  /** Human-readable reason when `ok` is false. */
  readonly reason: string | null;
  /** Compute units the simulation consumed (used to size a priority fee). */
  readonly unitsConsumed: number | null;
}

/**
 * Simulate a built transaction against the cluster — fail-closed.
 *
 * Per CLAUDE.md §5, simulation is a hard pre-send gate, so an RPC failure to
 * simulate returns `ok: false` (we do not sign/send blind). Callers should
 * surface the reason and let the user retry rather than submit unsimulated.
 */
export async function simulateSendTransaction(
  connection: Connection,
  tx: Transaction,
): Promise<SimulationOutcome> {
  let res: Awaited<ReturnType<Connection['simulateTransaction']>>;
  try {
    res = await connection.simulateTransaction(tx);
  } catch (err) {
    return {
      ok: false,
      reason: `Could not simulate the transaction (${err instanceof Error ? err.message : 'RPC error'}). For your safety it was not sent — please try again.`,
      unitsConsumed: null,
    };
  }
  const unitsConsumed = res.value.unitsConsumed ?? null;
  if (!res.value.err) return { ok: true, reason: null, unitsConsumed };
  return {
    ok: false,
    reason: describeSimulationError(res.value.err, res.value.logs),
    unitsConsumed,
  };
}

/**
 * Best-effort: overwrite a keypair's in-memory secret bytes after signing.
 *
 * web3.js v1 keeps the real secret in a private `_keypair.secretKey`; the public
 * `.secretKey` getter returns a fresh *copy*, so we must reach the internal
 * buffer to actually overwrite the plaintext key. After this the keypair is
 * unusable — fine, since signing is already done. The session vault retains the
 * master secret (a separate copy) so the wallet stays unlocked.
 */
export function zeroKeypairSecret(keypair: Keypair): void {
  try {
    const internal = (
      keypair as unknown as { _keypair?: { secretKey?: Uint8Array } }
    )._keypair;
    internal?.secretKey?.fill(0);
  } catch {
    /* best-effort */
  }
}

/**
 * Sign with every keypair in `signers`, submit, confirm, then zero the secrets
 * listed in `zeroAfter` (defaults to all signers) — so the plaintext key doesn't
 * linger past signing (CLAUDE.md §5). Used by native STAKING, where the new
 * stake-account keypair co-signs alongside the owner. (The vault + send paths use
 * the Kit signing pipeline instead — ADR-0005.)
 */
export async function signSendAndConfirmWith(
  connection: Connection,
  tx: Transaction,
  signers: Keypair[],
  zeroAfter: Keypair[] = signers,
): Promise<string> {
  try {
    tx.sign(...signers);
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(
      {
        signature: sig,
        blockhash: tx.recentBlockhash as string,
        lastValidBlockHeight: tx.lastValidBlockHeight as number,
      },
      'confirmed',
    );
    return sig;
  } finally {
    for (const kp of zeroAfter) zeroKeypairSecret(kp);
  }
}
