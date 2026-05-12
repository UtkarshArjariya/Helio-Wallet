import { Connection } from '@solana/web3.js'
import {
  createHelioRpcClient,
  createJupiterPriceFeedClient,
  createJupiterTokensClient,
} from '@helio/api'
import { createTokenMetadataCache } from './token-metadata-cache'
import { getExtensionProviderConfig } from '../extension-runtime/provider-config'

const config = getExtensionProviderConfig()

/** Resolve the current Solana cluster from localStorage preferences.
 *  Falls back to devnet (the cluster the Helio program is currently deployed on). */
function resolveCluster(): 'mainnet-beta' | 'devnet' {
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem('helio:pref:network')
    if (!raw) return 'devnet'
    const parsed = JSON.parse(raw)
    if (parsed === 'mainnet') return 'mainnet-beta'
    return 'devnet'  // 'testnet' and 'devnet' both route to devnet RPC for now
  } catch { return 'devnet' }
}

function urlFor(cluster: 'mainnet-beta' | 'devnet'): string {
  if (cluster === 'devnet') {
    return config.rpcEndpointPool.devnet[0]?.url
      ?? import.meta.env.VITE_HELIO_DEVNET_RPC_PRIMARY_URL
      ?? 'https://api.devnet.solana.com'
  }
  return config.rpcEndpointPool['mainnet-beta'][0]?.url
    ?? 'https://api.mainnet-beta.solana.com'
}

const activeCluster = resolveCluster()

/** Singleton Solana Connection. Cluster is decided at module load from the
 *  saved network preference; a network change persists across reload. */
export const connection = new Connection(urlFor(activeCluster), 'confirmed')

const priceFeedClient = createJupiterPriceFeedClient({
  baseUrls: [...config.jupiter.apiBaseUrls],
  apiKey: config.jupiter.apiKey ?? undefined,
})

/** Singleton RPC client (QuikNode primary + Helius fallback) and Jupiter price feed. */
export const rpcClient = createHelioRpcClient(
  { selectedNetwork: activeCluster, customRpcUrl: null, commitment: 'confirmed' },
  {
    priceFeedClient,
    rpcEndpointPool: {
      'mainnet-beta': [...config.rpcEndpointPool['mainnet-beta']],
      devnet:         [...config.rpcEndpointPool.devnet],
    },
  },
)

/** Singleton Jupiter Tokens v2 client. Shares the same apiKey + baseUrls as
 *  the price feed so we only authenticate once. */
export const jupiterTokensClient = createJupiterTokensClient({
  baseUrls: [...config.jupiter.apiBaseUrls],
  apiKey:   config.jupiter.apiKey ?? undefined,
})

/** Singleton token metadata cache backed by chrome.storage.local in the
 *  extension and localStorage on the web. */
export const tokenMetadataCache = createTokenMetadataCache()

/** Best-effort cluster label for UI surfaces. */
export const ACTIVE_CLUSTER: 'mainnet-beta' | 'devnet' = activeCluster
