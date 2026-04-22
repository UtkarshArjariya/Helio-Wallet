import type { DappTrustLevel, TransactionReviewWarning } from "@helio/types";

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

export interface DappRiskAssessment {
  readonly trustLevel: DappTrustLevel;
  readonly warnings: readonly TransactionReviewWarning[];
}

export interface DappConnectionRiskInput {
  readonly iconUrl: string | null;
  readonly name: string;
  readonly origin: string;
}

export interface DappMessageRiskInput extends DappConnectionRiskInput {
  readonly messageBase64: string;
  readonly messagePreview: string;
}

export interface DappTransactionRiskInput extends DappConnectionRiskInput {
  readonly programAddresses: readonly string[];
  readonly serializedTransactionBase64: string;
  readonly summaryLines: readonly string[];
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

export interface SwapExecutionPlan {
  readonly serializedTransactionBase64: string;
}

export interface SwapExecutionClient {
  buildSwapTransaction(input: {
    readonly inputMintAddress: string;
    readonly outputMintAddress: string;
    readonly inputAmountAtomic: string;
    readonly slippageBps: number;
    readonly userPublicKey: string;
  }): Promise<SwapExecutionPlan>;
}

export interface DappRiskProvider {
  assessConnection(input: DappConnectionRiskInput): Promise<DappRiskAssessment>;
  assessMessage(input: DappMessageRiskInput): Promise<DappRiskAssessment>;
  assessTransaction(
    input: DappTransactionRiskInput,
  ): Promise<DappRiskAssessment>;
}
