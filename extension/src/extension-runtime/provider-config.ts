import type { RpcEndpointConfig } from "@helio/types";

const DEFAULT_JUPITER_API_BASE_URL = "https://api.jup.ag";
const DEFAULT_JUPITER_API_FALLBACK_URL = "https://lite-api.jup.ag";
const DEFAULT_BLOWFISH_API_BASE_URL = "https://api.blowfish.xyz";

interface ExtensionProviderConfig {
  readonly blowfish: {
    readonly apiBaseUrl: string;
    readonly apiKey: string | null;
  };
  readonly jupiter: {
    readonly apiBaseUrls: readonly string[];
    readonly apiKey: string | null;
  };
  readonly rpcEndpointPool: {
    readonly devnet: readonly RpcEndpointConfig[];
    readonly "mainnet-beta": readonly RpcEndpointConfig[];
  };
}

function asOptionalEnvValue(value: string | undefined): string | null {
  const normalizedValue = value?.trim();

  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null;
}

function createMainnetRpcEndpointPool(): readonly RpcEndpointConfig[] {
  const primaryUrl = asOptionalEnvValue(
    import.meta.env.VITE_HELIO_MAINNET_RPC_PRIMARY_URL,
  );
  const primaryWebsocketUrl = asOptionalEnvValue(
    import.meta.env.VITE_HELIO_MAINNET_RPC_PRIMARY_WS_URL,
  );
  const fallbackUrl = asOptionalEnvValue(
    import.meta.env.VITE_HELIO_MAINNET_RPC_FALLBACK_URL,
  );
  const endpoints: RpcEndpointConfig[] = [];

  if (primaryUrl !== null) {
    endpoints.push({
      label: "QuickNode Mainnet",
      network: "mainnet-beta",
      url: primaryUrl,
      websocketUrl: primaryWebsocketUrl,
    });
  }

  if (fallbackUrl !== null) {
    endpoints.push({
      isFallback: true,
      label: "Helius Mainnet Fallback",
      network: "mainnet-beta",
      url: fallbackUrl,
      websocketUrl: null,
    });
  }

  return endpoints;
}

function createDevnetRpcEndpointPool(): readonly RpcEndpointConfig[] {
  const primaryUrl = asOptionalEnvValue(
    import.meta.env.VITE_HELIO_DEVNET_RPC_PRIMARY_URL,
  );

  if (primaryUrl === null) {
    return [];
  }

  return [
    {
      label: "Helius Devnet",
      network: "devnet",
      url: primaryUrl,
      websocketUrl: null,
    },
  ];
}

/**
 * Returns provider configuration for the extension runtime from Vite env vars.
 *
 * @returns Runtime provider configuration with RPC and API failover ordering.
 */
export function getExtensionProviderConfig(): ExtensionProviderConfig {
  const mainnetRpcEndpoints = createMainnetRpcEndpointPool();
  const devnetRpcEndpoints = createDevnetRpcEndpointPool();
  const jupiterPrimaryBaseUrl =
    asOptionalEnvValue(import.meta.env.VITE_HELIO_JUPITER_API_BASE_URL) ??
    DEFAULT_JUPITER_API_BASE_URL;
  const jupiterFallbackBaseUrl =
    asOptionalEnvValue(import.meta.env.VITE_HELIO_JUPITER_API_FALLBACK_URL) ??
    DEFAULT_JUPITER_API_FALLBACK_URL;

  return {
    blowfish: {
      apiBaseUrl:
        asOptionalEnvValue(import.meta.env.VITE_HELIO_BLOWFISH_API_BASE_URL) ??
        DEFAULT_BLOWFISH_API_BASE_URL,
      apiKey: asOptionalEnvValue(import.meta.env.VITE_HELIO_BLOWFISH_API_KEY),
    },
    jupiter: {
      apiBaseUrls: [jupiterPrimaryBaseUrl, jupiterFallbackBaseUrl],
      apiKey: asOptionalEnvValue(import.meta.env.VITE_HELIO_JUPITER_API_KEY),
    },
    rpcEndpointPool: {
      devnet: devnetRpcEndpoints,
      "mainnet-beta": mainnetRpcEndpoints,
    },
  };
}
