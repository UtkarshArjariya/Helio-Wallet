import { Connection } from '@solana/web3.js'
import { createHelioRpcClient, createJupiterPriceFeedClient } from '@helio/api'
import { getExtensionProviderConfig } from '../extension-runtime/provider-config'

const config = getExtensionProviderConfig()

/** Singleton Solana Connection using the primary QuikNode endpoint. */
export const connection = new Connection(
  config.rpcEndpointPool['mainnet-beta'][0]?.url ?? 'https://api.mainnet-beta.solana.com',
  'confirmed',
)

const priceFeedClient = createJupiterPriceFeedClient({
  baseUrls: [...config.jupiter.apiBaseUrls],
  apiKey: config.jupiter.apiKey ?? undefined,
})

/**
 * Singleton RPC client backed by QuikNode (primary) + Helius (fallback) endpoints
 * from VITE_HELIO_MAINNET_RPC_* env vars. Jupiter price feed uses the configured
 * API key for real-time USD prices.
 */
export const rpcClient = createHelioRpcClient(
  { selectedNetwork: 'mainnet-beta', customRpcUrl: null, commitment: 'confirmed' },
  {
    priceFeedClient,
    rpcEndpointPool: {
      'mainnet-beta': [...config.rpcEndpointPool['mainnet-beta']],
      devnet: [...config.rpcEndpointPool.devnet],
    },
  },
)
