import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { Keypair, PublicKey } from '@solana/web3.js'
import { createDefaultAutoYieldState } from '@helio/solana'
import type { AutoYieldState, TokenHolding } from '@helio/types'
import { rpcClient, connection } from '../lib/rpc-service'
import { WALLET_ADDRESS_KEY } from './RouterContext'
import {
  fetchOnChainVaultState,
  saveKeypairToSession,
  loadSessionKeypair,
  clearSessionKeypair,
  initializeAutoYield as onChainInitialize,
  pauseAutoYield as onChainPause,
  resumeAutoYield as onChainResume,
  updateAutoYieldConfig as onChainUpdateConfig,
  sendSol as onChainSendSol,
  sendSolPlain as onChainSendSolPlain,
  sweepSol as onChainSweepSol,
  withdrawVaultSol as onChainWithdrawVaultSol,
  withdrawSol as onChainWithdrawSol,
  deriveHelioAddresses,
  resolveStableMint,
  type OnChainVaultState,
} from '../lib/helio-program'

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
  initialized: boolean
  isActive:   boolean
  balance:    number    // SOL in reserve vault
  threshold:  number    // SOL to trigger auto-stake (from deployThresholdAtomic)
  deployed:   number    // SOL deployed
  rewards:    number
  strategy:   'Helio Validator' | 'Liquid Staking' | 'Stable Yield'
  pdaAddress: string    // config PDA base58
  lastSweepAt:  number  // unix timestamp
  lastWithdrawAt: number
  rules: {
    roundUpTransfers:   boolean
    roundUpSwaps:       boolean
    percentageIncoming: boolean
  }
}

export interface TxResult { signature: string; explorerUrl: string }

interface WalletContextType {
  fullAddress:  string
  shortAddress: string
  address:      string
  name:         string
  tokens:       Token[]
  totalBalanceUsd: number
  vault:        VaultState
  loading:      boolean
  error:        string | null
  network:      { label: string; isHealthy: boolean; latencyMs: number | null }
  hasKeypair:   boolean

  // Read
  refresh: () => void
  setWalletAddress: (address: string, label?: string) => void

  // Local-only fallback (optimistic UI while tx confirms)
  updateVault:     (updates: Partial<VaultState>) => void
  updateVaultRule: (key: keyof VaultState['rules'], value: boolean) => void

  // On-chain writes
  initializeVault: () => Promise<TxResult>
  pauseVault:   () => Promise<TxResult>
  resumeVault:  () => Promise<TxResult>
  updateVaultConfig: (args: {
    enabled: boolean; sweepMode: number; percentageBps: number
    roundUpUnitLamports: number; deployThresholdAtomic: number
  }) => Promise<TxResult>
  addFundsToVault: (amountLamports: number) => Promise<TxResult>
  withdrawFromVault: (amountLamports: number) => Promise<TxResult>
  sendSolWithSweep: (recipient: string, amountLamports: number, sweepBps: number) => Promise<TxResult>
  sendSolPlain:     (recipient: string, amountLamports: number) => Promise<TxResult>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

function mapHolding(h: TokenHolding): Token {
  return {
    id:       h.assetKind === 'native-sol' ? 'sol' : h.mintAddress,
    symbol:   h.symbol,
    name:     h.name,
    balance:  parseFloat(h.amountDisplay.replace(/,/g, '')) || 0,
    price:    h.usdPrice ?? 0,
    change24h: h.dailyChangePercentage,
  }
}

const PROTOCOL_MAP: Record<number, VaultState['strategy']> = {
  0: 'Liquid Staking',  // Kamino
  1: 'Helio Validator',
  2: 'Stable Yield',
}

function mapOnChainVault(state: OnChainVaultState, solPrice: number): VaultState {
  const safe = solPrice > 0 ? solPrice : 145
  const { config, reserve } = state

  if (!config || !reserve) {
    return {
      ...DEFAULT_VAULT,
      initialized: state.initialized,
      pdaAddress:  state.configPda.toBase58(),
    }
  }

  const balance   = Number(reserve.solBalanceLamports)   / 1e9
  const threshold = Number(config.deployThresholdAtomic) / 1e9  // threshold stored as lamports

  return {
    initialized:  true,
    isActive:     config.enabled && !config.paused,
    balance,
    threshold,
    deployed:     0,   // tracked externally (not in reserve state)
    rewards:      0,
    strategy:     PROTOCOL_MAP[config.activeProtocol] ?? 'Helio Validator',
    pdaAddress:   state.configPda.toBase58(),
    lastSweepAt:  reserve.lastSweepUnixTs,
    lastWithdrawAt: reserve.lastWithdrawUnixTs,
    rules: {
      roundUpTransfers:   config.sweepMode === 0,
      roundUpSwaps:       false,
      percentageIncoming: config.sweepMode === 1,
    },
  }
}

const DEFAULT_VAULT: VaultState = {
  initialized:    false,
  isActive:       false,
  balance:        0,
  threshold:      0.10,
  deployed:       0,
  rewards:        0,
  strategy:       'Helio Validator',
  pdaAddress:     '',
  lastSweepAt:    0,
  lastWithdrawAt: 0,
  rules: { roundUpTransfers: false, roundUpSwaps: false, percentageIncoming: false },
}

function explorerUrl(sig: string): string {
  return `https://solscan.io/tx/${sig}`
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WalletContext = createContext<WalletContextType | undefined>(undefined)

const REFRESH_MS = 30_000
const DEFAULT_AUTO_YIELD = createDefaultAutoYieldState()

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletAddress, setWalletAddressState] = useState(() =>
    localStorage.getItem(WALLET_ADDRESS_KEY) ?? '',
  )
  const [walletLabel, setWalletLabel] = useState(() =>
    localStorage.getItem('helio:label') ?? 'Main Wallet',
  )
  const [tokens,          setTokens]          = useState<Token[]>([])
  const [totalBalanceUsd, setTotalBalanceUsd] = useState(0)
  const [vault,           setVault]           = useState<VaultState>(DEFAULT_VAULT)
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [hasKeypair,      setHasKeypair]      = useState(() => !!loadSessionKeypair())
  const [network, setNetwork] = useState<WalletContextType['network']>({
    label: 'Mainnet', isHealthy: true, latencyMs: null,
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
        label:        localStorage.getItem('helio:label') ?? 'Main Wallet',
        shortAddress: fmtAddress(address),
        derivationIndex: 0,
        kind: 'imported' as const,
      }

      // Fetch token portfolio + network status + on-chain vault in parallel
      const [snapshot, networkStatus, onChain] = await Promise.all([
        rpcClient.getWalletDashboardSnapshot(account, [], DEFAULT_AUTO_YIELD),
        rpcClient.getNetworkStatus(),
        fetchOnChainVaultState(connection, address).catch(() => null),
      ])

      const mappedTokens = snapshot.tokenRows.map(mapHolding)
      const solPrice = mappedTokens.find(t => t.id === 'sol')?.price ?? 145

      setTokens(mappedTokens)
      setTotalBalanceUsd(snapshot.portfolio.totalUsdValue)
      setNetwork({
        label:     networkStatus.endpointLabel,
        isHealthy: networkStatus.isHealthy,
        latencyMs: networkStatus.averageLatencyMs,
      })

      if (onChain) {
        setVault(mapOnChainVault(onChain, solPrice))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch wallet data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!walletAddress) return
    fetchDashboard()
    intervalRef.current = setInterval(fetchDashboard, REFRESH_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [walletAddress, fetchDashboard])

  // ── Helpers for on-chain ops ────────────────────────────────────────────────

  function requireKeypair(): Keypair {
    const kp = loadSessionKeypair()
    if (!kp) throw new Error('Wallet locked — please import your wallet to sign transactions.')
    return kp
  }

  function txResult(sig: string): TxResult {
    return { signature: sig, explorerUrl: explorerUrl(sig) }
  }

  // ── On-chain actions ────────────────────────────────────────────────────────

  const initializeVault = useCallback(async (): Promise<TxResult> => {
    const kp  = requireKeypair()
    const mint = resolveStableMint(connection)
    const sig = await onChainInitialize(connection, kp, mint)
    setVault(v => ({ ...v, initialized: true, isActive: true }))
    await fetchDashboard()
    return txResult(sig)
  }, [fetchDashboard])

  const pauseVault = useCallback(async (): Promise<TxResult> => {
    const kp  = requireKeypair()
    const sig = await onChainPause(connection, kp)
    setVault(v => ({ ...v, isActive: false }))
    await fetchDashboard()
    return txResult(sig)
  }, [fetchDashboard])

  const resumeVault = useCallback(async (): Promise<TxResult> => {
    const kp  = requireKeypair()
    const sig = await onChainResume(connection, kp)
    setVault(v => ({ ...v, isActive: true }))
    await fetchDashboard()
    return txResult(sig)
  }, [fetchDashboard])

  const updateVaultConfig = useCallback(async (args: {
    enabled: boolean; sweepMode: number; percentageBps: number
    roundUpUnitLamports: number; deployThresholdAtomic: number
  }): Promise<TxResult> => {
    const kp = requireKeypair()
    // Fetch current on-chain config to fill unchanged fields
    const addr = localStorage.getItem(WALLET_ADDRESS_KEY)!
    const state = await fetchOnChainVaultState(connection, addr)
    const current = state.config
    const sig = await onChainUpdateConfig(connection, kp, {
      enabled:               args.enabled,
      paused:                current?.paused ?? false,
      sweepMode:             args.sweepMode,
      roundUpUnitLamports:   args.roundUpUnitLamports,
      percentageBps:         args.percentageBps,
      deployThresholdAtomic: args.deployThresholdAtomic,
      activeProtocol:        current?.activeProtocol ?? 0,
      allowedProtocolsMask:  current?.allowedProtocolsMask ?? 1,
      excludedProtocolsMask: current?.excludedProtocolsMask ?? 0,
    })
    await fetchDashboard()
    return txResult(sig)
  }, [fetchDashboard])

  const addFundsToVault = useCallback(async (amountLamports: number): Promise<TxResult> => {
    const kp  = requireKeypair()
    const sig = await onChainSweepSol(connection, kp, amountLamports)
    await fetchDashboard()
    return txResult(sig)
  }, [fetchDashboard])

  const withdrawFromVault = useCallback(async (amountLamports: number): Promise<TxResult> => {
    const kp = requireKeypair()
    const addr = localStorage.getItem(WALLET_ADDRESS_KEY)!
    const state = await fetchOnChainVaultState(connection, addr)
    // Use the AutoYield-aware withdraw if the vault is initialized, otherwise direct
    const sig = state.initialized
      ? await onChainWithdrawSol(connection, kp, amountLamports)
      : await onChainWithdrawVaultSol(connection, kp, amountLamports)
    await fetchDashboard()
    return txResult(sig)
  }, [fetchDashboard])

  const sendSolWithSweep = useCallback(async (
    recipient: string, amountLamports: number, sweepBps: number,
  ): Promise<TxResult> => {
    const kp  = requireKeypair()
    const sig = await onChainSendSol(connection, kp, new PublicKey(recipient), amountLamports, sweepBps)
    await fetchDashboard()
    return txResult(sig)
  }, [fetchDashboard])

  const sendSolPlain = useCallback(async (
    recipient: string, amountLamports: number,
  ): Promise<TxResult> => {
    const kp  = requireKeypair()
    const sig = await onChainSendSolPlain(connection, kp, new PublicKey(recipient), amountLamports)
    await fetchDashboard()
    return txResult(sig)
  }, [fetchDashboard])

  // ── Local-only fallbacks ────────────────────────────────────────────────────

  const updateVault = useCallback((updates: Partial<VaultState>) =>
    setVault(v => ({ ...v, ...updates })), [])

  const updateVaultRule = useCallback((key: keyof VaultState['rules'], value: boolean) =>
    setVault(v => ({ ...v, rules: { ...v.rules, [key]: value } })), [])

  const refresh = useCallback(() => fetchDashboard(), [fetchDashboard])

  const setWalletAddress = useCallback((address: string, label = 'Main Wallet') => {
    localStorage.setItem(WALLET_ADDRESS_KEY, address)
    localStorage.setItem('helio:label', label)
    setWalletAddressState(address)
    setWalletLabel(label)
  }, [])

  const addr  = walletAddress
  const short = addr ? fmtAddress(addr) : '—'

  return (
    <WalletContext.Provider value={{
      fullAddress: addr, shortAddress: short, address: short,
      name: walletLabel, tokens, totalBalanceUsd, vault,
      loading, error, network, hasKeypair,
      refresh, setWalletAddress,
      updateVault, updateVaultRule,
      initializeVault,
      pauseVault, resumeVault, updateVaultConfig,
      addFundsToVault, withdrawFromVault, sendSolWithSweep, sendSolPlain,
    }}>
      {children}
    </WalletContext.Provider>
  )
}

/**
 * Generate a new random Solana wallet.
 * Persists the public key to localStorage and the secret key to sessionStorage.
 */
export function generateAndSaveWallet(label = 'Main Wallet'): string {
  const keypair = Keypair.generate()
  const address = keypair.publicKey.toBase58()
  localStorage.setItem(WALLET_ADDRESS_KEY, address)
  localStorage.setItem('helio:label', label)
  saveKeypairToSession(keypair)
  return address
}

/**
 * Import a wallet by storing the provided keypair for the current session.
 * Call this after decrypting a vault or importing a seed phrase.
 */
export function importKeypairToSession(keypair: Keypair): void {
  const address = keypair.publicKey.toBase58()
  localStorage.setItem(WALLET_ADDRESS_KEY, address)
  saveKeypairToSession(keypair)
}

/** Lock the wallet by clearing the session keypair. */
export function lockWallet(): void {
  clearSessionKeypair()
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within WalletProvider')
  return ctx
}
