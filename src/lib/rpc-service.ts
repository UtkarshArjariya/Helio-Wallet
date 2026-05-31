import { Connection } from '@solana/web3.js'
import {
  createHelioRpcClient,
  createHelioKitRpc,
  createHelioKitSigner,
  createJupiterPriceFeedClient,
  createJupiterTokensClient,
  createJupiterChartsClient,
  createJupiterSwapClient,
} from '@helio/api'
import { createTokenMetadataCache } from './token-metadata-cache'
import { getExtensionProviderConfig } from '../extension-runtime/provider-config'
import { rpcBucket, solanaFetchMiddleware, validateRpcUrl } from './rpc-guard'

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

/** Resolve the active RPC URL through the scheme allowlist, falling back to a
 *  safe public endpoint if a misconfigured env/preference slips through. */
function safeRpcUrl(cluster: 'mainnet-beta' | 'devnet'): string {
  try {
    return validateRpcUrl(urlFor(cluster))
  } catch {
    return cluster === 'devnet'
      ? 'https://api.devnet.solana.com'
      : 'https://api.mainnet-beta.solana.com'
  }
}

/** Singleton Solana Connection. Cluster is decided at module load from the
 *  saved network preference; a network change persists across reload.
 *  All RPC traffic is paced by the token-bucket rate limiter in `rpc-guard`. */
export const connection = new Connection(safeRpcUrl(activeCluster), {
  commitment: 'confirmed',
  fetchMiddleware: solanaFetchMiddleware,
})

const priceFeedClient = createJupiterPriceFeedClient({
  baseUrls: [...config.jupiter.apiBaseUrls],
  apiKey: config.jupiter.apiKey ?? undefined,
})

/** Singleton RPC client (QuikNode primary + Helius fallback) and Jupiter price feed. */
export const rpcClient = createHelioRpcClient(
  { selectedNetwork: activeCluster, customRpcUrl: null, commitment: 'confirmed' },
  {
    priceFeedClient,
    // Pace the failover transport with the same token-bucket limiter as the
    // singleton connection, so every RPC path is rate-limited.
    fetchMiddleware: solanaFetchMiddleware,
    // The web3.js v2 (@solana/kit) read leaf shares the SAME bucket as the v1
    // path above, so the two SDKs draw from one rate-limit budget against the
    // shared upstream RPC host instead of pacing independently.
    kitTransport: { limiter: rpcBucket },
    rpcEndpointPool: {
      'mainnet-beta': [...config.rpcEndpointPool['mainnet-beta']],
      devnet:         [...config.rpcEndpointPool.devnet],
    },
  },
)

/** Hardened Kit (web3.js v2) RPC client for the active endpoint — reads + the
 *  key-free write surface (simulate/send/getSignatureStatus). Shares the SAME
 *  token-bucket limiter as every other RPC path. (ADR-0005.) */
export const kitRpc = createHelioKitRpc(
  {
    ...(config.rpcEndpointPool[activeCluster][0] ?? {
      label: 'active',
      network: activeCluster,
    }),
    url: safeRpcUrl(activeCluster),
  },
  { limiter: rpcBucket },
)

/** Kit signing pipeline for the Helio vault instructions (build → fail-closed
 *  simulate → WebCrypto-signer sign → send → MV3 poll-confirm → zero secret).
 *  The Kit replacement for the Anchor `.rpc()` signing in `helio-program.ts`. */
export const kitSigner = createHelioKitSigner(kitRpc)

/** Singleton Jupiter Tokens v2 client. Shares the same apiKey + baseUrls as
 *  the price feed so we only authenticate once. */
export const jupiterTokensClient = createJupiterTokensClient({
  baseUrls: [...config.jupiter.apiBaseUrls],
  apiKey:   config.jupiter.apiKey ?? undefined,
})

/** Singleton token metadata cache backed by chrome.storage.local in the
 *  extension and localStorage on the web. */
export const tokenMetadataCache = createTokenMetadataCache()

/** Singleton OHLCV chart client backed by `datapi.jup.ag` (the same host
 *  Jupiter's own UI uses for historical prices). */
export const jupiterChartsClient = createJupiterChartsClient({
  apiKey: config.jupiter.apiKey ?? undefined,
})

/** Best-effort cluster label for UI surfaces. */
export const ACTIVE_CLUSTER: 'mainnet-beta' | 'devnet' = activeCluster

/** Human-friendly label for the active cluster (e.g. "Mainnet", "Devnet").
 *  Use this anywhere the UI shows which network the wallet is talking to —
 *  never hardcode "Mainnet". */
export const ACTIVE_CLUSTER_LABEL: 'Mainnet' | 'Devnet' =
  activeCluster === 'mainnet-beta' ? 'Mainnet' : 'Devnet'

// ─── Jupiter swap (MAINNET — the single mainnet exception) ────────────────────
//
// Everything else in Helio runs on devnet, but Jupiter only has liquidity on
// mainnet. This dedicated, rate-limited mainnet Connection is used ONLY for the
// swap simulate/send/confirm path; no other screen touches it.

/** Dedicated MAINNET connection used only by the swap flow. */
export const swapConnection = new Connection(safeRpcUrl('mainnet-beta'), {
  commitment: 'confirmed',
  fetchMiddleware: solanaFetchMiddleware,
})

/** Jupiter swap client. Uses api.jup.ag (with key) when a key is configured,
 *  otherwise the keyless lite-api.jup.ag host. */
export const jupiterSwapClient = createJupiterSwapClient({
  host: config.jupiter.apiKey ? 'https://api.jup.ag' : 'https://lite-api.jup.ag',
  apiKey: config.jupiter.apiKey ?? undefined,
})
