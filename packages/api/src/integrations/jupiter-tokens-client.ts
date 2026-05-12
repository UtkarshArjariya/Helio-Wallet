import ky from "ky";
import { executeWithOrderedFailover } from "../failover/ordered-failover";

const DEFAULT_JUPITER_TIMEOUT_MS = 5_000;

/**
 * Maximum number of mints addressable in a single Jupiter /tokens/v2/search
 * call. The Jupiter docs advertise the query parameter accepting comma-separated
 * mints; we cap at 100 to stay within typical URL/length budgets.
 */
export const JUPITER_TOKENS_BATCH_LIMIT = 100;

/** Domain error thrown when a single-mint lookup yields no result. */
export class TokenNotFoundError extends Error {
  readonly mint: string;
  constructor(mint: string) {
    super(`Jupiter has no token metadata for mint ${mint}`);
    this.name = "TokenNotFoundError";
    this.mint = mint;
  }
}

/**
 * Normalized shape used across the wallet for token metadata. `icon` is the
 * URL of the icon image (we never store bytes — the browser's HTTP cache
 * handles those efficiently). `fetchedAt` is an ISO timestamp recorded by the
 * client so cache layers can compute staleness without re-walking the response.
 */
export interface TokenMetadata {
  readonly mint: string;
  readonly name: string;
  readonly symbol: string;
  readonly decimals: number;
  readonly icon: string | null;
  readonly isVerified: boolean;
  readonly organicScore: number;
  readonly tags: readonly string[];
  readonly fetchedAt: string;
}

/** Synthesized response used when Jupiter returns no row for a queried mint. */
function fallbackMetadata(mint: string): TokenMetadata {
  return {
    mint,
    name: "Unknown token",
    symbol: "—",
    decimals: 0,
    icon: null,
    isVerified: false,
    organicScore: 0,
    tags: [],
    fetchedAt: new Date().toISOString(),
  };
}

/** Raw Jupiter Tokens v2 row — partial typing limited to fields we consume. */
interface JupiterTokenV2Row {
  readonly id?: string;
  readonly address?: string;
  readonly name?: string;
  readonly symbol?: string;
  readonly decimals?: number;
  readonly icon?: string;
  readonly logoURI?: string;
  readonly isVerified?: boolean;
  readonly organicScore?: number;
  readonly tags?: readonly string[];
}

function normalizeRow(row: JupiterTokenV2Row): TokenMetadata | null {
  const mint = row.id ?? row.address;
  if (typeof mint !== "string" || mint.length === 0) return null;
  return {
    mint,
    name: row.name ?? "",
    symbol: row.symbol ?? "",
    decimals: typeof row.decimals === "number" ? row.decimals : 0,
    icon: row.icon ?? row.logoURI ?? null,
    isVerified: row.isVerified ?? false,
    organicScore: typeof row.organicScore === "number" ? row.organicScore : 0,
    tags: row.tags ?? [],
    fetchedAt: new Date().toISOString(),
  };
}

function createJupiterHeaders(apiKey?: string): HeadersInit | undefined {
  if (apiKey === undefined || apiKey.length === 0) return undefined;
  return { "x-api-key": apiKey };
}

function buildSearchUrl(baseUrl: string): string {
  return new URL("tokens/v2/search", `${baseUrl.replace(/\/+$/, "")}/`).toString();
}

function buildTagUrl(baseUrl: string): string {
  return new URL("tokens/v2/tag", `${baseUrl.replace(/\/+$/, "")}/`).toString();
}

function chunk<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function searchAtBaseUrl(
  baseUrl: string,
  query: string,
  apiKey?: string,
): Promise<readonly TokenMetadata[]> {
  const body = await ky
    .get(buildSearchUrl(baseUrl), {
      headers: createJupiterHeaders(apiKey),
      retry: 0,
      searchParams: { query },
      timeout: DEFAULT_JUPITER_TIMEOUT_MS,
    })
    .json<readonly JupiterTokenV2Row[]>();

  return body
    .map(normalizeRow)
    .filter((row): row is TokenMetadata => row !== null);
}

async function tagAtBaseUrl(
  baseUrl: string,
  tag: string,
  apiKey?: string,
): Promise<readonly TokenMetadata[]> {
  const body = await ky
    .get(buildTagUrl(baseUrl), {
      headers: createJupiterHeaders(apiKey),
      retry: 0,
      searchParams: { query: tag },
      timeout: DEFAULT_JUPITER_TIMEOUT_MS,
    })
    .json<readonly JupiterTokenV2Row[]>();

  return body
    .map(normalizeRow)
    .filter((row): row is TokenMetadata => row !== null);
}

export interface JupiterTokensClientOptions {
  /** Optional Jupiter Pro API key; the same value used by the price feed client. */
  readonly apiKey?: string;
  /** Ordered base URLs — primary first, then fallbacks. */
  readonly baseUrls: readonly string[];
}

/**
 * Client for Jupiter Tokens API v2.
 *
 * Provides metadata lookups (single + batch) and free-text search backed by
 * `/tokens/v2/search` and the verified tag list at `/tokens/v2/tag`. Re-uses
 * the same `apiKey`/`baseUrls`/`ky`/failover plumbing as the price feed
 * client so we don't duplicate HTTP wiring.
 */
export interface JupiterTokensClient {
  /**
   * Fetches metadata for a single mint.
   *
   * @param mint - Mint pubkey as base58.
   * @returns Normalized metadata.
   * @throws {TokenNotFoundError} If Jupiter has no row for the mint.
   */
  getToken(mint: string): Promise<TokenMetadata>;

  /**
   * Batch-fetches metadata for up to `JUPITER_TOKENS_BATCH_LIMIT` mints per
   * underlying request. Missing rows are filled with a fallback object so the
   * caller can persist the absence and avoid refetch storms.
   *
   * @param mints - Mint pubkeys as base58. Duplicates are de-duplicated.
   * @returns Mapping of mint → metadata, with synthesized fallbacks for misses.
   */
  getTokens(mints: readonly string[]): Promise<ReadonlyMap<string, TokenMetadata>>;

  /**
   * Free-text token search for picker UIs. Matches Jupiter's `/tokens/v2/search`
   * behavior (symbol/name/mint prefix).
   *
   * @param query - Free-text query.
   * @returns Ordered list of matches.
   */
  searchTokens(query: string): Promise<readonly TokenMetadata[]>;

  /**
   * Fetches the verified-tag list from `/tokens/v2/tag?query=verified`.
   * Useful for seeding the cache with reputable tokens at startup.
   */
  listVerifiedTokens(): Promise<readonly TokenMetadata[]>;
}

/**
 * Constructs a {@link JupiterTokensClient}. Pass the same `apiKey` and
 * `baseUrls` you already use for `createJupiterPriceFeedClient` — both clients
 * authenticate the same Jupiter account and share the same failover order.
 */
export function createJupiterTokensClient(
  options: JupiterTokensClientOptions,
): JupiterTokensClient {
  const baseUrls = options.baseUrls.filter((u) => u.length > 0);

  async function search(query: string): Promise<readonly TokenMetadata[]> {
    if (query.length === 0 || baseUrls.length === 0) return [];
    return executeWithOrderedFailover(baseUrls, (baseUrl) =>
      searchAtBaseUrl(baseUrl, query, options.apiKey),
    );
  }

  async function tag(query: string): Promise<readonly TokenMetadata[]> {
    if (baseUrls.length === 0) return [];
    return executeWithOrderedFailover(baseUrls, (baseUrl) =>
      tagAtBaseUrl(baseUrl, query, options.apiKey),
    );
  }

  return {
    async getToken(mint) {
      const rows = await search(mint);
      const match = rows.find((row) => row.mint === mint);
      if (!match) throw new TokenNotFoundError(mint);
      return match;
    },

    async getTokens(mints) {
      const unique = [...new Set(mints)];
      const result = new Map<string, TokenMetadata>();
      if (unique.length === 0) return result;

      const batches = chunk(unique, JUPITER_TOKENS_BATCH_LIMIT);
      const responses = await Promise.all(
        batches.map((batch) => search(batch.join(","))),
      );

      for (const rows of responses) {
        for (const row of rows) {
          // First write wins for duplicate mints across overlapping batches.
          if (!result.has(row.mint)) result.set(row.mint, row);
        }
      }

      // Fallback for any mint Jupiter didn't return — callers persist this so
      // the next render doesn't refetch the same missing mint.
      for (const mint of unique) {
        if (!result.has(mint)) result.set(mint, fallbackMetadata(mint));
      }

      return result;
    },

    async searchTokens(query) {
      return search(query);
    },

    async listVerifiedTokens() {
      return tag("verified");
    },
  };
}

/** Exported for cache layers that want to materialize "unknown mint" entries. */
export { fallbackMetadata as createFallbackTokenMetadata };
