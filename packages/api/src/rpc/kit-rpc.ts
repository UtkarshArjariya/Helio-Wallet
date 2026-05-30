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
  createSolanaRpcFromTransport,
  type JsonParsedTokenAccount,
  type Rpc,
  type RpcTransport,
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

/** The Kit-based read leaf. All addresses are passed/returned as base58 strings. */
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
