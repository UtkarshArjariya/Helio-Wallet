import ky from "ky";
import { executeWithOrderedFailover } from "../failover/ordered-failover";
import type {
  PriceFeedClient,
  TokenPriceSnapshot,
} from "./integration-contracts";

const DEFAULT_JUPITER_TIMEOUT_MS = 4_000;
const JUPITER_PRICE_BATCH_LIMIT = 50;

interface JupiterPriceFeedClientOptions {
  readonly apiKey?: string;
  readonly baseUrls: readonly string[];
}

interface JupiterPriceApiItem {
  readonly price?: number;
  readonly priceChange24h?: number;
  readonly usdPrice?: number;
}

function chunkMintAddresses(
  mintAddresses: readonly string[],
  chunkSize: number,
): readonly (readonly string[])[] {
  const chunks: string[][] = [];

  for (let index = 0; index < mintAddresses.length; index += chunkSize) {
    chunks.push(mintAddresses.slice(index, index + chunkSize));
  }

  return chunks;
}

function createJupiterHeaders(apiKey?: string): HeadersInit | undefined {
  if (apiKey === undefined || apiKey.length === 0) {
    return undefined;
  }

  return {
    "x-api-key": apiKey,
  };
}

function buildJupiterPriceUrl(baseUrl: string): string {
  return new URL("price/v3", `${baseUrl.replace(/\/+$/, "")}/`).toString();
}

function mapJupiterPriceResponse(
  priceResponse: Readonly<Record<string, JupiterPriceApiItem>>,
): readonly TokenPriceSnapshot[] {
  const fetchedAtIso = new Date().toISOString();

  return Object.entries(priceResponse)
    .filter(([, priceSnapshot]) => {
      const resolvedUsdPrice = priceSnapshot.usdPrice ?? priceSnapshot.price;

      return typeof resolvedUsdPrice === "number";
    })
    .map(([mintAddress, priceSnapshot]) => ({
      mintAddress,
      usdPrice: priceSnapshot.usdPrice ?? priceSnapshot.price ?? 0,
      changePercentage24h: priceSnapshot.priceChange24h ?? 0,
      fetchedAtIso,
    }));
}

async function fetchPriceBatchFromBaseUrl(
  baseUrl: string,
  mintAddresses: readonly string[],
  apiKey?: string,
): Promise<readonly TokenPriceSnapshot[]> {
  const priceResponse = await ky
    .get(buildJupiterPriceUrl(baseUrl), {
      headers: createJupiterHeaders(apiKey),
      retry: 0,
      searchParams: {
        ids: mintAddresses.join(","),
      },
      timeout: DEFAULT_JUPITER_TIMEOUT_MS,
    })
    .json<Readonly<Record<string, JupiterPriceApiItem>>>();

  return mapJupiterPriceResponse(priceResponse);
}

async function fetchPriceBatchWithFailover(
  baseUrls: readonly string[],
  mintAddresses: readonly string[],
  apiKey?: string,
): Promise<readonly TokenPriceSnapshot[]> {
  return executeWithOrderedFailover(baseUrls, (baseUrl) =>
    fetchPriceBatchFromBaseUrl(baseUrl, mintAddresses, apiKey),
  );
}

/**
 * Creates a Jupiter-backed token price client with base-URL failover.
 *
 * @param options - Jupiter API key and ordered base URLs.
 * @returns Price-feed client for token USD values.
 */
export function createJupiterPriceFeedClient(
  options: JupiterPriceFeedClientOptions,
): PriceFeedClient {
  const baseUrls = options.baseUrls.filter((baseUrl) => baseUrl.length > 0);

  return {
    async listTokenPrices(mintAddresses) {
      if (mintAddresses.length === 0 || baseUrls.length === 0) {
        return [];
      }

      const uniqueMintAddresses = [...new Set(mintAddresses)];
      const priceSnapshots = await Promise.all(
        chunkMintAddresses(uniqueMintAddresses, JUPITER_PRICE_BATCH_LIMIT).map(
          (mintAddressChunk) =>
            fetchPriceBatchWithFailover(
              baseUrls,
              mintAddressChunk,
              options.apiKey,
            ),
        ),
      );

      return priceSnapshots.flat();
    },
  };
}
