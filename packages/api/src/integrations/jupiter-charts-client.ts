import ky from "ky";
import { executeWithOrderedFailover } from "../failover/ordered-failover";

const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * Jupiter charts API interval enum.
 *
 * Empirically the `/v2/charts/<mint>` endpoint accepts these `interval` union
 * values; passing anything else returns 400 with "Expected union value".
 */
export type JupiterChartInterval =
  | "1_MINUTE"
  | "5_MINUTE"
  | "1_HOUR"
  | "1_DAY";

/** Single OHLCV candle returned by `datapi.jup.ag`. `time` is in unix seconds. */
export interface JupiterCandle {
  readonly time: number;     // unix seconds (NOT ms)
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

interface JupiterChartsResponse {
  readonly candles: readonly JupiterCandle[];
}

export interface JupiterChartsClientOptions {
  /**
   * Base URLs in failover order. Defaults to the public `datapi.jup.ag` host
   * — a separate origin from `api.jup.ag` (which doesn't expose history).
   */
  readonly baseUrls?: readonly string[];
  /** Optional Jupiter API key (reused for parity even though datapi is public today). */
  readonly apiKey?: string;
}

function buildUrl(baseUrl: string, mint: string): string {
  return new URL(
    `v2/charts/${mint}`,
    `${baseUrl.replace(/\/+$/, "")}/`,
  ).toString();
}

function createHeaders(apiKey?: string): HeadersInit | undefined {
  if (apiKey === undefined || apiKey.length === 0) return undefined;
  return { "x-api-key": apiKey };
}

async function fetchAt(
  baseUrl: string,
  mint: string,
  params: { interval: JupiterChartInterval; candles: number; toMs: number },
  apiKey?: string,
): Promise<readonly JupiterCandle[]> {
  const body = await ky
    .get(buildUrl(baseUrl, mint), {
      headers: createHeaders(apiKey),
      retry: 0,
      searchParams: {
        type: "price",
        interval: params.interval,
        candles: params.candles,
        to: params.toMs,
      },
      timeout: DEFAULT_TIMEOUT_MS,
    })
    .json<JupiterChartsResponse>();
  return body.candles ?? [];
}

/**
 * Client for Jupiter's OHLCV chart endpoint at `datapi.jup.ag`.
 *
 * Unofficial relative to `api.jup.ag` (the documented price/swap host) but
 * publicly reachable and used by Jupiter's own UI; this is the only first-
 * party source of historical Solana token prices today.
 */
export interface JupiterChartsClient {
  /**
   * Fetch OHLCV candles ending at `toMs` (default: now).
   *
   * @param mint     - Mint pubkey (use wrapped-SOL `So11…1112` for native SOL).
   * @param interval - One of the supported interval enum values.
   * @param count    - Number of candles to return.
   * @param toMs     - Optional cutoff timestamp in milliseconds.
   */
  getCandles(
    mint: string,
    interval: JupiterChartInterval,
    count: number,
    toMs?: number,
  ): Promise<readonly JupiterCandle[]>;
}

/** Factory for {@link JupiterChartsClient}. */
export function createJupiterChartsClient(
  options: JupiterChartsClientOptions = {},
): JupiterChartsClient {
  const baseUrls = (options.baseUrls ?? ["https://datapi.jup.ag"]).filter(
    (u) => u.length > 0,
  );

  return {
    async getCandles(mint, interval, count, toMs) {
      if (baseUrls.length === 0 || count <= 0) return [];
      const cutoffMs = toMs ?? Date.now();
      return executeWithOrderedFailover(baseUrls, (baseUrl) =>
        fetchAt(
          baseUrl,
          mint,
          { interval, candles: count, toMs: cutoffMs },
          options.apiKey,
        ),
      );
    },
  };
}
