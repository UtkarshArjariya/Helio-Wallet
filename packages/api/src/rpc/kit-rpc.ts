/**
 * Kit (web3.js v2) RPC **read leaf**.
 *
 * Per ADR-0004 this is the first slice of the v1 → v2 migration: a small reader
 * exposing the four pure read methods (`getBalance`, `getLatestBlockhash`,
 * `getAccountInfo`, `getParsedTokenAccountsByOwner`). It has **zero Anchor
 * coupling, zero signing, zero key material** — so it carries no custody risk.
 *
 * The reader is built with `createSolanaRpcFromTransport` over the hardened
 * {@link createRateLimitedKitTransport} — **not** `createSolanaRpc(url)`, which
 * would build its own un-hardened default transport. Routing through the custom
 * transport is what enforces the rate-limit + URL-scheme mandates on every call.
 *
 * Lamports/blockheights are `bigint` in Kit; this module returns them as
 * `bigint` and lets the caller convert at the DTO edge (see
 * `compat-boundary.ts`'s `lamportsToNumber`). Returned addresses are kept as
 * base58 strings — the legacy `@helio/types` contract is preserved by the
 * consuming `helio-rpc-client.ts`, not here.
 */

import type { RpcEndpointConfig } from "@helio/types";
import {
  type AccountInfoBase,
  type AccountInfoWithPubkey,
  type Address,
  type Base64EncodedWireTransaction,
  createSolanaRpcFromTransport,
  type JsonParsedTokenAccount,
  type Rpc,
  type RpcTransport,
  type Signature,
  type SolanaRpcApi,
} from "@solana/kit";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { toKitAddress } from "../compat-boundary";
import { formatAtomicAmount } from "./atomic-amount";
import {
  createRateLimitedKitTransport,
  type KitTransportOptions,
} from "./kit-transport";

const DEFAULT_COMMITMENT = "confirmed" as const;

/** A single parsed SPL-token account, with addresses kept as base58 strings. */
export interface KitParsedTokenAccount {
  /** The token account (ATA) address. */
  readonly tokenAccountAddress: string;
  /** The mint this account holds. */
  readonly mintAddress: string;
  /** The token program that owns this account (Token or Token-2022). */
  readonly tokenProgramAddress: string;
  /** Balance in the smallest unit, as a decimal string. */
  readonly amountAtomic: string;
  /** Human-readable balance (RPC-provided `uiAmountString`, or a computed fallback). */
  readonly amountDisplay: string;
  /** The mint's decimal precision. */
  readonly decimals: number;
}

/** Result of {@link HelioKitRpcReader.getLatestBlockhash}. */
export interface KitLatestBlockhash {
  /** Base58 blockhash. */
  readonly blockhash: string;
  /** Last block height at which the blockhash is a valid lifetime specifier. */
  readonly lastValidBlockHeight: bigint;
}

/** Normalized account info from {@link HelioKitRpcReader.getAccountInfo}. */
export interface KitAccountInfo {
  /** Lamport balance held by the account. */
  readonly lamports: bigint;
  /** Base58 address of the program that owns the account. */
  readonly ownerAddress: string;
  /** Whether the account is executable (a program). */
  readonly executable: boolean;
  /** Size of the account data in bytes. */
  readonly space: bigint;
  /**
   * The account's data, **base64-encoded** (the account is read with
   * `encoding: "base64"`). Decode with `atob`/`Buffer.from(data, "base64")`.
   */
  readonly data: string;
}

/** Outcome of a Kit `simulateTransaction` (mirrors the v1 `SimulationOutcome` fields). */
export interface KitSimulationResult {
  /** The program error, or `null` if the transaction simulated clean. */
  readonly err: unknown | null;
  /** Program log lines (`null` if simulation failed before execution). */
  readonly logs: readonly string[] | null;
  /** Compute units consumed (used to size a priority-fee CU limit). */
  readonly unitsConsumed: bigint | null;
}

/** A signature's confirmation status from `getSignatureStatuses`. */
export interface KitSignatureStatus {
  /** How far the signature has progressed, or `null` if unknown. */
  readonly confirmationStatus: "processed" | "confirmed" | "finalized" | null;
  /** The transaction error, or `null` if it succeeded. */
  readonly err: unknown | null;
  /** The slot in which the transaction was processed. */
  readonly slot: bigint;
}

/**
 * The Kit-based RPC client. All addresses/signatures are passed and returned as
 * base58 strings. The write methods (`simulate*`/`send*`/`getSignatureStatus`)
 * carry **no key material** — they transmit caller-built wire transactions — so
 * this remains a key-free leaf; signing happens in the app's signing pipeline.
 */
export interface HelioKitRpcReader {
  /**
   * Fetches the lamport balance of an account.
   *
   * @param ownerAddress - Base58 address to read.
   * @returns The balance in lamports (Kit returns this as `bigint`).
   * @throws {Error} If the address is invalid or the RPC call fails.
   */
  getBalanceLamports(ownerAddress: string): Promise<bigint>;
  /**
   * Fetches the latest blockhash and its last-valid block height.
   *
   * @returns The blockhash and `lastValidBlockHeight`.
   * @throws {Error} If the RPC call fails.
   */
  getLatestBlockhash(): Promise<KitLatestBlockhash>;
  /**
   * Fetches information about an account, or `null` if it does not exist.
   *
   * @param accountAddress - Base58 address to read.
   * @returns Normalized account info, or `null` when the account is not found.
   * @throws {Error} If the address is invalid or the RPC call fails.
   */
  getAccountInfo(accountAddress: string): Promise<KitAccountInfo | null>;
  /**
   * Fetches all non-empty SPL-token accounts (Token and Token-2022) owned by an address.
   *
   * @param ownerAddress - Base58 address of the token-account owner.
   * @returns The owner's non-zero token accounts.
   * @throws {Error} If the address is invalid or the RPC call fails.
   */
  getParsedTokenAccountsByOwner(
    ownerAddress: string,
  ): Promise<readonly KitParsedTokenAccount[]>;
  /**
   * Simulates a base64 wire transaction with `replaceRecentBlockhash` (so a
   * slightly-stale blockhash doesn't fail simulation, and an UNSIGNED compiled
   * transaction can be simulated before signing). **No key material.**
   *
   * @param wireBase64 - Base64 wire transaction (`getBase64EncodedWireTransaction`).
   * @returns The program error (if any), logs, and compute units consumed.
   * @throws {Error} If the RPC call itself fails — callers MUST treat this fail-closed.
   */
  simulateTransactionBase64(wireBase64: string): Promise<KitSimulationResult>;
  /**
   * Submits an already-signed base64 wire transaction. **No key material.**
   *
   * @param wireBase64 - The base64-encoded SIGNED wire transaction.
   * @param options - `skipPreflight` (default `true`; callers simulate first).
   * @returns The transaction signature (base58).
   * @throws {Error} If submission fails.
   */
  sendTransactionBase64(
    wireBase64: string,
    options?: { skipPreflight?: boolean },
  ): Promise<string>;
  /**
   * Fetches one signature's confirmation status — the MV3-safe poll-confirm
   * primitive (subscriptions need a `wss://` endpoint MV3 workers suspend).
   *
   * @param signature - The base58 transaction signature.
   * @returns The status, or `null` if the cluster has not yet seen the signature.
   * @throws {Error} If the RPC call fails.
   */
  getSignatureStatus(signature: string): Promise<KitSignatureStatus | null>;
}

/**
 * The element type of a `getTokenAccountsByOwner(..., { encoding: 'jsonParsed' })`
 * response `value`. Reconstructed from Kit's exported types rather than derived
 * via `ReturnType`, because `getTokenAccountsByOwner` is overloaded and
 * `ReturnType` would resolve to the wrong (base58) overload.
 */
type JsonParsedTokenAccountEntry = AccountInfoWithPubkey<
  AccountInfoBase &
    Readonly<{
      data: Readonly<{
        parsed: Readonly<{ info: JsonParsedTokenAccount; type: "account" }>;
        program: Address;
        space: bigint;
      }>;
    }>
>;

function parseTokenAccountEntry(
  entry: JsonParsedTokenAccountEntry,
): KitParsedTokenAccount | null {
  const { info } = entry.account.data.parsed;
  const { tokenAmount } = info;

  // Drop dust/empty accounts (mirrors the legacy v1 read path).
  if (tokenAmount.amount === "0") {
    return null;
  }

  const decimals = Number(tokenAmount.decimals);

  return {
    tokenAccountAddress: entry.pubkey,
    mintAddress: info.mint,
    tokenProgramAddress: entry.account.owner,
    amountAtomic: tokenAmount.amount,
    amountDisplay:
      tokenAmount.uiAmountString ??
      formatAtomicAmount(BigInt(tokenAmount.amount), decimals),
    decimals,
  };
}

function createReaderFromRpc(rpc: Rpc<SolanaRpcApi>): HelioKitRpcReader {
  return {
    async getBalanceLamports(ownerAddress) {
      const { value } = await rpc
        .getBalance(toKitAddress(ownerAddress), {
          commitment: DEFAULT_COMMITMENT,
        })
        .send();
      return BigInt(value);
    },

    async getLatestBlockhash() {
      const { value } = await rpc
        .getLatestBlockhash({ commitment: DEFAULT_COMMITMENT })
        .send();
      return {
        blockhash: value.blockhash,
        lastValidBlockHeight: BigInt(value.lastValidBlockHeight),
      };
    },

    async getAccountInfo(accountAddress) {
      const { value } = await rpc
        .getAccountInfo(toKitAddress(accountAddress), {
          commitment: DEFAULT_COMMITMENT,
          encoding: "base64",
        })
        .send();

      if (value === null) {
        return null;
      }

      // `encoding: "base64"` → `data` is a `[base64String, "base64"]` tuple.
      return {
        lamports: BigInt(value.lamports),
        ownerAddress: value.owner,
        executable: value.executable,
        space: BigInt(value.space),
        data: value.data[0],
      };
    },

    async getParsedTokenAccountsByOwner(ownerAddress) {
      const owner = toKitAddress(ownerAddress);
      const [tokenAccounts, token2022Accounts] = await Promise.all([
        rpc
          .getTokenAccountsByOwner(
            owner,
            { programId: toKitAddress(TOKEN_PROGRAM_ID.toBase58()) },
            { commitment: DEFAULT_COMMITMENT, encoding: "jsonParsed" },
          )
          .send(),
        rpc
          .getTokenAccountsByOwner(
            owner,
            { programId: toKitAddress(TOKEN_2022_PROGRAM_ID.toBase58()) },
            { commitment: DEFAULT_COMMITMENT, encoding: "jsonParsed" },
          )
          .send(),
      ]);

      return [...tokenAccounts.value, ...token2022Accounts.value]
        .map(parseTokenAccountEntry)
        .filter(
          (account): account is KitParsedTokenAccount => account !== null,
        );
    },

    async simulateTransactionBase64(wireBase64) {
      const { value } = await rpc
        .simulateTransaction(wireBase64 as Base64EncodedWireTransaction, {
          encoding: "base64",
          replaceRecentBlockhash: true,
          commitment: DEFAULT_COMMITMENT,
        })
        .send();
      return {
        err: value.err,
        logs: value.logs,
        unitsConsumed: value.unitsConsumed ?? null,
      };
    },

    async sendTransactionBase64(wireBase64, options = {}) {
      return rpc
        .sendTransaction(wireBase64 as Base64EncodedWireTransaction, {
          encoding: "base64",
          skipPreflight: options.skipPreflight ?? true,
          preflightCommitment: DEFAULT_COMMITMENT,
        })
        .send();
    },

    async getSignatureStatus(signatureString) {
      const { value } = await rpc
        .getSignatureStatuses([signatureString as Signature], {
          searchTransactionHistory: false,
        })
        .send();
      const status = value[0];
      if (!status) {
        return null;
      }
      return {
        confirmationStatus: status.confirmationStatus,
        err: status.err,
        slot: status.slot,
      };
    },
  };
}

/**
 * Creates the production Kit read leaf for a single RPC endpoint, wired through
 * the hardened (rate-limited, scheme-validated) transport.
 *
 * @param endpoint - The RPC endpoint to read from.
 * @param options - Optional limiter / transport-factory overrides.
 * @returns A {@link HelioKitRpcReader} bound to `endpoint`.
 */
export function createHelioKitRpc(
  endpoint: RpcEndpointConfig,
  options: KitTransportOptions = {},
): HelioKitRpcReader {
  const transport = createRateLimitedKitTransport(endpoint.url, options);
  return createReaderFromRpc(createSolanaRpcFromTransport(transport));
}

/**
 * Builds a {@link HelioKitRpcReader} from an arbitrary {@link RpcTransport}.
 *
 * Primarily a test seam: supply a mock transport to exercise the reader's
 * mapping logic (and the real Kit RPC API response handling) without any
 * network access.
 *
 * @param transport - The transport to back the reader with.
 * @returns A {@link HelioKitRpcReader} over the supplied transport.
 */
export function createHelioKitRpcReaderFromTransport(
  transport: RpcTransport,
): HelioKitRpcReader {
  return createReaderFromRpc(createSolanaRpcFromTransport(transport));
}
