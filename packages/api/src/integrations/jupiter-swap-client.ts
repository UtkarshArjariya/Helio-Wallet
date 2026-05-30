import ky from "ky";

/**
 * Jupiter Swap API client (MAINNET) — quote + build-swap-transaction.
 *
 * Uses the current `/swap/v1/*` routes (the legacy `/v6/*` is superseded).
 * Host is either `https://lite-api.jup.ag` (no key) or `https://api.jup.ag`
 * (requires an `x-api-key` header). The `/swap` endpoint returns a base64
 * **v0 VersionedTransaction** — sign + simulate + send it on a MAINNET
 * connection (Jupiter has no devnet liquidity).
 */

const DEFAULT_SWAP_TIMEOUT_MS = 10_000;

export interface JupiterSwapClientOptions {
  /** `https://api.jup.ag` (with key) or `https://lite-api.jup.ag` (no key). */
  readonly host: string;
  /** API key — sent as `x-api-key` only when present (required for api.jup.ag). */
  readonly apiKey?: string;
}

export interface JupiterQuoteRequest {
  readonly inputMint: string;
  readonly outputMint: string;
  /** Input amount in ATOMIC units, as an integer string. */
  readonly amountAtomic: string;
  readonly slippageBps: number;
}

export interface JupiterQuote {
  readonly inputMint: string;
  readonly outputMint: string;
  readonly inAmount: string;
  readonly outAmount: string;
  /** Minimum received after slippage (atomic). */
  readonly otherAmountThreshold: string;
  readonly priceImpactPct: string;
  readonly slippageBps: number;
  readonly routeLabels: readonly string[];
  /** The full, unmodified quoteResponse — echoed back to /swap verbatim. */
  readonly raw: unknown;
}

export interface JupiterSwapTransaction {
  readonly swapTransactionBase64: string;
  readonly lastValidBlockHeight: number;
}

export interface JupiterSwapClient {
  getQuote(request: JupiterQuoteRequest): Promise<JupiterQuote>;
  getSwapTransaction(input: {
    readonly quote: JupiterQuote;
    readonly userPublicKey: string;
  }): Promise<JupiterSwapTransaction>;
}

interface RawQuoteResponse {
  readonly inputMint: string;
  readonly inAmount: string;
  readonly outputMint: string;
  readonly outAmount: string;
  readonly otherAmountThreshold: string;
  readonly priceImpactPct: string;
  readonly slippageBps: number;
  readonly routePlan?: readonly { readonly swapInfo?: { readonly label?: string } }[];
}

function headersFor(options: JupiterSwapClientOptions): HeadersInit | undefined {
  return options.apiKey ? { "x-api-key": options.apiKey } : undefined;
}

function base(host: string): string {
  return `${host.replace(/\/+$/, "")}/swap/v1`;
}

/**
 * Create a Jupiter swap client.
 *
 * @param options - Host + optional API key.
 * @returns A {@link JupiterSwapClient}.
 */
export function createJupiterSwapClient(
  options: JupiterSwapClientOptions,
): JupiterSwapClient {
  const headers = headersFor(options);

  return {
    async getQuote(request) {
      const raw = await ky
        .get(`${base(options.host)}/quote`, {
          headers,
          retry: 0,
          timeout: DEFAULT_SWAP_TIMEOUT_MS,
          searchParams: {
            inputMint: request.inputMint,
            outputMint: request.outputMint,
            amount: request.amountAtomic,
            slippageBps: request.slippageBps,
            swapMode: "ExactIn",
            restrictIntermediateTokens: "true",
          },
        })
        .json<RawQuoteResponse>();

      return {
        inputMint: raw.inputMint,
        outputMint: raw.outputMint,
        inAmount: raw.inAmount,
        outAmount: raw.outAmount,
        otherAmountThreshold: raw.otherAmountThreshold,
        priceImpactPct: raw.priceImpactPct,
        slippageBps: raw.slippageBps,
        routeLabels: (raw.routePlan ?? [])
          .map((step) => step.swapInfo?.label)
          .filter((label): label is string => typeof label === "string"),
        raw,
      };
    },

    async getSwapTransaction({ quote, userPublicKey }) {
      const response = await ky
        .post(`${base(options.host)}/swap`, {
          headers,
          retry: 0,
          timeout: DEFAULT_SWAP_TIMEOUT_MS,
          json: {
            quoteResponse: quote.raw,
            userPublicKey,
            wrapAndUnwrapSol: true,
            dynamicComputeUnitLimit: true,
            dynamicSlippage: true,
            prioritizationFeeLamports: {
              priorityLevelWithMaxLamports: {
                maxLamports: 1_000_000,
                priorityLevel: "high",
              },
            },
          },
        })
        .json<{ swapTransaction: string; lastValidBlockHeight: number }>();

      return {
        swapTransactionBase64: response.swapTransaction,
        lastValidBlockHeight: response.lastValidBlockHeight,
      };
    },
  };
}
