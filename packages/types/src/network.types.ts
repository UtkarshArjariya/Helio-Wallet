import type { HelioNetwork } from "./wallet.types";

export interface RpcEndpointConfig {
  readonly label: string;
  readonly url: string;
  readonly network: HelioNetwork;
  readonly websocketUrl?: string | null;
  readonly isFallback?: boolean;
}

export interface NetworkPreference {
  readonly selectedNetwork: HelioNetwork;
  readonly customRpcUrl: string | null;
  readonly commitment: "processed" | "confirmed" | "finalized";
}

export interface NetworkStatus {
  readonly network: HelioNetwork;
  readonly endpointLabel: string;
  readonly averageLatencyMs: number | null;
  readonly lastHealthyAtIso: string | null;
  readonly isHealthy: boolean;
}
