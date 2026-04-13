export interface TokenPriceSnapshot {
  readonly mintAddress: string;
  readonly usdPrice: number;
  readonly changePercentage24h: number;
  readonly fetchedAtIso: string;
}

export interface ValidatorSnapshot {
  readonly voteAccountAddress: string;
  readonly name: string;
  readonly apy: number;
  readonly commissionPercentage: number;
  readonly uptimePercentage: number;
  readonly totalStakeSol: number;
  readonly decentralizationScore: number;
}

export interface SwapQuoteSnapshot {
  readonly inputMintAddress: string;
  readonly outputMintAddress: string;
  readonly inputAmountAtomic: string;
  readonly outputAmountAtomic: string;
  readonly routeLabel: string;
  readonly priceImpactPercentage: number;
  readonly slippageBps: number;
}

export interface PriceFeedClient {
  listTokenPrices(
    mintAddresses: readonly string[],
  ): Promise<readonly TokenPriceSnapshot[]>;
}

export interface ValidatorDirectoryClient {
  listValidators(): Promise<readonly ValidatorSnapshot[]>;
}

export interface SwapQuoteClient {
  getQuote(
    inputMintAddress: string,
    outputMintAddress: string,
    inputAmountAtomic: string,
    slippageBps: number,
  ): Promise<SwapQuoteSnapshot>;
}
