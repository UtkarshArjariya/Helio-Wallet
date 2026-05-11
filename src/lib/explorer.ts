/**
 * Solscan URL builders that honor the active network preference.
 *
 * Mainnet:  https://solscan.io/<kind>/<id>
 * Devnet:   https://solscan.io/<kind>/<id>?cluster=devnet
 * Testnet:  https://solscan.io/<kind>/<id>?cluster=testnet
 *
 * These read the network preference from localStorage at call time (typically
 * an onClick handler) so that switching networks in Settings updates new clicks
 * immediately without needing a re-render.
 */

import type { NetworkCode } from './preferences'

const NETWORK_STORAGE_KEY = 'helio:pref:network'

function readNetwork(): NetworkCode {
  try {
    if (typeof localStorage === 'undefined') return 'devnet'
    const raw = localStorage.getItem(NETWORK_STORAGE_KEY)
    if (!raw) return 'devnet'
    const parsed = JSON.parse(raw)
    if (parsed === 'mainnet' || parsed === 'testnet' || parsed === 'devnet') return parsed
    return 'devnet'
  } catch {
    return 'devnet'
  }
}

function clusterQuery(network: NetworkCode): string {
  return network === 'mainnet' ? '' : `?cluster=${network}`
}

export function solscanTxUrl(signature: string, network?: NetworkCode): string {
  const n = network ?? readNetwork()
  return `https://solscan.io/tx/${signature}${clusterQuery(n)}`
}

export function solscanAccountUrl(address: string, network?: NetworkCode): string {
  const n = network ?? readNetwork()
  return `https://solscan.io/account/${address}${clusterQuery(n)}`
}
