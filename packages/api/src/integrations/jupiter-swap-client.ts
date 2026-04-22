import ky from "ky";
import { executeWithOrderedFailover } from "../failover/ordered-failover";
import type {
  SwapExecutionClient,
  SwapExecutionPlan,
  SwapQuoteClient,
  SwapQuoteSnapshot,
} from "./integration-contracts";

const DEFAULT_JUPITER_TIMEOUT_MS = 6_000;

interface JupiterSwapClientOptions {
  readonly apiKey?: string;
  readonly baseUrls: readonly string[];
}

interface JupiterQuoteResponse {
  readonly inAmount: string;
  readonly outAmount: string;
  readonly priceImpactPct?: string;
  readonly routePlan?: readonly unknown[];
}

interface JupiterSwapResponse {
  readonly swapTransaction: string;
}

function createJupiterHeaders(apiKey?: string): HeadersInit | undefined {
  if (apiKey === undefined || apiKey.length === 0) {
    return undefined;
  }

  return {
    "x-api-key": apiKey,
  };
}

function buildQuoteUrl(baseUrl: string): string {
  return new URL("swap/v1/quote", `${baseUrl.replace(/\/+$/, "")}/`).toString();
}

function buildSwapUrl(baseUrl: string): string {
  return new URL("swap/v1/swap", `${baseUrl.replace(/\/+$/, "")}/`).toString();
}

function mapQuoteToSnapshot(input: {
  readonly inputMintAddress: string;
  readonly outputMintAddress: string;
  readonly inputAmountAtomic: string;
  readonly slippageBps: number;
  readonly quote: JupiterQuoteResponse;
}): SwapQuoteSnapshot {
  const priceImpactPercentage = Number(input.quote.priceImpactPct ?? "0") * 100;

  return {
    inputMintAddress: input.inputMintAddress,
    outputMintAddress: input.outputMintAddress,
    inputAmountAtomic: input.quote.inAmount ?? input.inputAmountAtomic,
    outputAmountAtomic: input.quote.outAmount,
    routeLabel:
      input.quote.routePlan !== undefined && input.quote.routePlan.length > 1
        ? "Multi-hop Jupiter route"
        : "Direct Jupiter route",
    priceImpactPercentage: Number.isFinite(priceImpactPercentage)
      ? priceImpactPercentage
      : 0,
    slippageBps: input.slippageBps,
  };
}

async function fetchQuoteFromBaseUrl(input: {
  readonly apiKey?: string;
  readonly baseUrl: string;
  readonly inputAmountAtomic: string;
  readonly inputMintAddress: string;
  readonly outputMintAddress: string;
  readonly slippageBps: number;
}): Promise<SwapQuoteSnapshot> {
  const quoteResponse = await ky
    .get(buildQuoteUrl(input.baseUrl), {
      headers: createJupiterHeaders(input.apiKey),
      retry: 0,
      searchParams: {
        amount: input.inputAmountAtomic,
        inputMint: input.inputMintAddress,
        outputMint: input.outputMintAddress,
        slippageBps: input.slippageBps.toString(),
      },
      timeout: DEFAULT_JUPITER_TIMEOUT_MS,
    })
    .json<JupiterQuoteResponse>();

  return mapQuoteToSnapshot({
    inputAmountAtomic: input.inputAmountAtomic,
    inputMintAddress: input.inputMintAddress,
    outputMintAddress: input.outputMintAddress,
    quote: quoteResponse,
    slippageBps: input.slippageBps,
  });
}

async function buildSwapPlanFromBaseUrl(input: {
  readonly apiKey?: string;
  readonly baseUrl: string;
  readonly inputAmountAtomic: string;
  readonly inputMintAddress: string;
  readonly outputMintAddress: string;
  readonly slippageBps: number;
  readonly userPublicKey: string;
}): Promise<SwapExecutionPlan> {
  const quoteResponse = await ky
    .get(buildQuoteUrl(input.baseUrl), {
      headers: createJupiterHeaders(input.apiKey),
      retry: 0,
      searchParams: {
        amount: input.inputAmountAtomic,
        inputMint: input.inputMintAddress,
        outputMint: input.outputMintAddress,
        slippageBps: input.slippageBps.toString(),
      },
      timeout: DEFAULT_JUPITER_TIMEOUT_MS,
    })
    .json<JupiterQuoteResponse>();

  const swapResponse = await ky
    .post(buildSwapUrl(input.baseUrl), {
      headers: createJupiterHeaders(input.apiKey),
      json: {
        dynamicComputeUnitLimit: true,
        quoteResponse,
        userPublicKey: input.userPublicKey,
        wrapAndUnwrapSol: true,
      },
      retry: 0,
      timeout: DEFAULT_JUPITER_TIMEOUT_MS,
    })
    .json<JupiterSwapResponse>();

  return {
    serializedTransactionBase64: swapResponse.swapTransaction,
  };
}

/**
 * Creates Jupiter swap quote and execution clients with base-URL failover.
 */
export function createJupiterSwapClient(
  options: JupiterSwapClientOptions,
): SwapQuoteClient & SwapExecutionClient {
  const baseUrls = options.baseUrls.filter((baseUrl) => baseUrl.length > 0);

  return {
    async getQuote(
      inputMintAddress,
      outputMintAddress,
      inputAmountAtomic,
      slippageBps,
    ) {
      if (baseUrls.length === 0) {
        throw new Error("No Jupiter base URL is configured.");
      }

      return executeWithOrderedFailover(baseUrls, (baseUrl) =>
        fetchQuoteFromBaseUrl({
          apiKey: options.apiKey,
          baseUrl,
          inputAmountAtomic,
          inputMintAddress,
          outputMintAddress,
          slippageBps,
        }),
      );
    },

    async buildSwapTransaction(input) {
      if (baseUrls.length === 0) {
        throw new Error("No Jupiter base URL is configured.");
      }

      return executeWithOrderedFailover(baseUrls, (baseUrl) =>
        buildSwapPlanFromBaseUrl({
          apiKey: options.apiKey,
          baseUrl,
          inputAmountAtomic: input.inputAmountAtomic,
          inputMintAddress: input.inputMintAddress,
          outputMintAddress: input.outputMintAddress,
          slippageBps: input.slippageBps,
          userPublicKey: input.userPublicKey,
        }),
      );
    },
  };
}
