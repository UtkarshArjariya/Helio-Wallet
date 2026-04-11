export interface RpcEndpointConfig {
  readonly label: string;
  readonly url: string;
  readonly network: 'mainnet-beta' | 'devnet' | 'custom';
}

export interface NetworkPreference {
  readonly selectedNetwork: 'mainnet-beta' | 'devnet' | 'custom';
  readonly customRpcUrl: string | null;
}

