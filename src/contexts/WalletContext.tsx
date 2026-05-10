import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { Keypair } from '@solana/web3.js'
import { createDefaultAutoYieldState } from '@helio/solana'
import type { AutoYieldState, TokenHolding } from '@helio/types'
import { rpcClient } from '../lib/rpc-service'
import { WALLET_ADDRESS_KEY } from './RouterContext'

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface Token {
  id: string
  symbol: string
  name: string
  balance: number
  price: number
  change24h: number
}

export interface VaultState {
  isActive: boolean
  balance: number      // SOL in reserve
  threshold: number    // SOL to trigger auto-stake
  deployed: number     // SOL deployed to staking
  rewards: number      // SOL earned as rewards
  strategy: 'Helio Validator' | 'Liquid Staking' | 'Stable Yield'
  rules: {
    roundUpTransfers: boolean
    roundUpSwaps: boolean
    percentageIncoming: boolean
  }
}

interface WalletContextType {
  fullAddress: string
  shortAddress: string
  /** @deprecated use shortAddress for display */
  address: string
  name: string
  tokens: Token[]
  totalBalanceUsd: number
  vault: VaultState
  loading: boolean
  error: string | null
  network: { label: string; isHealthy: boolean; latencyMs: number | null }
  updateVault: (updates: Partial<VaultState>) => void
  updateVaultRule: (key: keyof VaultState['rules'], value: boolean) => void
  refresh: () => void
  /** Saves a new wallet address and triggers a data refresh. */
  setWalletAddress: (address: string, label?: string) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shortAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

function mapHolding(h: TokenHolding): Token {
  const balance = parseFloat(h.amountDisplay.replace(/,/g, '')) || 0
  return {
    id: h.assetKind === 'native-sol' ? 'sol' : h.mintAddress,
    symbol: h.symbol,
    name: h.name,
    balance,
    price: h.usdPrice ?? 0,
    change24h: h.dailyChangePercentage,
  }
}

function mapAutoYield(state: AutoYieldState, solPrice: number): VaultState {
  const sol = state.reserve.balances.find((b) => b.assetKind === 'native-sol')
  const safePrice = solPrice > 0 ? solPrice : 145

  const protocolMap: Record<string, VaultState['strategy']> = {
    kamino: 'Liquid Staking',
    jito: 'Helio Validator',
    marinade: 'Stable Yield',
  }

  return {
    isActive: state.settings.enabled && !state.settings.paused,
    balance: sol ? Number(sol.amountAtomic) / 1e9 : state.reserve.totalUsdValue / safePrice,
    threshold: state.settings.deployThresholdUsd / safePrice,
    deployed: state.reserve.totalDeployedUsd / safePrice,
    rewards: 0,
    strategy: protocolMap[state.settings.activeProtocol] ?? 'Helio Validator',
    rules: {
      roundUpTransfers: state.settings.sweepMode === 'round-up',
      roundUpSwaps: false,
      percentageIncoming: state.settings.sweepMode === 'percentage',
    },
  }
}

const DEFAULT_VAULT: VaultState = {
  isActive: false,
  balance: 0,
  threshold: 0.10,
  deployed: 0,
  rewards: 0,
  strategy: 'Helio Validator',
  rules: { roundUpTransfers: false, roundUpSwaps: false, percentageIncoming: false },
}

const REFRESH_INTERVAL_MS = 30_000

// ─── Context ──────────────────────────────────────────────────────────────────

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletAddress, setWalletAddressState] = useState<string>(() =>
    localStorage.getItem(WALLET_ADDRESS_KEY) ?? '',
  )
  const [walletLabel, setWalletLabel] = useState<string>(() =>
    localStorage.getItem('helio:label') ?? 'Main Wallet',
  )
  const [tokens, setTokens] = useState<Token[]>([])
  const [totalBalanceUsd, setTotalBalanceUsd] = useState(0)
  const [vault, setVault] = useState<VaultState>(DEFAULT_VAULT)
  const [autoYieldState] = useState<AutoYieldState>(() => createDefaultAutoYieldState())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [network, setNetwork] = useState<WalletContextType['network']>({
    label: 'Mainnet',
    isHealthy: true,
    latencyMs: null,
  })

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchDashboard = useCallback(async () => {
    const address = localStorage.getItem(WALLET_ADDRESS_KEY)
    if (!address) return

    setLoading(true)
    setError(null)

    try {
      const account = {
        address,
        label: localStorage.getItem('helio:label') ?? 'Main Wallet',
        shortAddress: shortAddress(address),
        derivationIndex: 0,
        kind: 'imported' as const,
      }

      const [snapshot, networkStatus] = await Promise.all([
        rpcClient.getWalletDashboardSnapshot(account, [], autoYieldState),
        rpcClient.getNetworkStatus(),
      ])

      const mappedTokens = snapshot.tokenRows.map(mapHolding)
      const solPrice = mappedTokens.find((t) => t.id === 'sol')?.price ?? 145

      setTokens(mappedTokens)
      setTotalBalanceUsd(snapshot.portfolio.totalUsdValue)
      setVault(mapAutoYield(autoYieldState, solPrice))
      setNetwork({
        label: networkStatus.endpointLabel,
        isHealthy: networkStatus.isHealthy,
        latencyMs: networkStatus.averageLatencyMs,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch wallet data.')
    } finally {
      setLoading(false)
    }
  }, [autoYieldState])

  // Fetch on mount and whenever the saved address changes
  useEffect(() => {
    if (!walletAddress) return

    fetchDashboard()

    intervalRef.current = setInterval(fetchDashboard, REFRESH_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [walletAddress, fetchDashboard])

  const updateVault = useCallback((updates: Partial<VaultState>) => {
    setVault((prev) => ({ ...prev, ...updates }))
  }, [])

  const updateVaultRule = useCallback((key: keyof VaultState['rules'], value: boolean) => {
    setVault((prev) => ({ ...prev, rules: { ...prev.rules, [key]: value } }))
  }, [])

  const refresh = useCallback(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const setWalletAddress = useCallback((address: string, label = 'Main Wallet') => {
    localStorage.setItem(WALLET_ADDRESS_KEY, address)
    localStorage.setItem('helio:label', label)
    setWalletAddressState(address)
    setWalletLabel(label)
  }, [])

  const addr = walletAddress
  const short = addr ? shortAddress(addr) : '—'

  return (
    <WalletContext.Provider value={{
      fullAddress: addr,
      shortAddress: short,
      address: short,
      name: walletLabel,
      tokens,
      totalBalanceUsd,
      vault,
      loading,
      error,
      network,
      updateVault,
      updateVaultRule,
      refresh,
      setWalletAddress,
    }}>
      {children}
    </WalletContext.Provider>
  )
}

/**
 * Generates a new random Solana keypair, persists the public key to localStorage,
 * and returns the public key string.
 */
export function generateAndSaveWallet(label = 'Main Wallet'): string {
  const keypair = Keypair.generate()
  const address = keypair.publicKey.toBase58()
  localStorage.setItem(WALLET_ADDRESS_KEY, address)
  localStorage.setItem('helio:label', label)
  return address
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within WalletProvider')
  return ctx
}
