import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { Keypair } from '@solana/web3.js'
import { createDefaultAutoYieldState } from '@helio/solana'
import type { AutoYieldState, TokenHolding, SmartTransactionReview } from '@helio/types'
import { rpcClient, connection, jupiterTokensClient, tokenMetadataCache, swapConnection, jupiterSwapClient, kitSigner, stakeSigner, kitRpc } from '../lib/rpc-service'
import type { JupiterQuote } from '@helio/api'
import { deserializeSwapTransaction, simulateSwap, signSendSwap } from '../lib/swap'
import { WALLET_ADDRESS_KEY } from './RouterContext'
import { loadSecret } from '../lib/secret-store'
import {
  fetchOnChainVaultState,
  saveKeypairToSession,
  loadSessionKeypair,
  clearSessionKeypair,
  // Vault + staking signing now run on the Kit pipeline (`kitSigner` / `stakeSigner`).
  // `zeroKeypairSecret` remains only for the Jupiter swap path (still web3.js v1).
  zeroKeypairSecret,
  resolveStableMint,
  type OnChainVaultState,
} from '../lib/helio-program'
import { reviewNativeSolSend, resolvePriorityFeeMicroLamportsPerCu } from '../lib/send-review'
import {
  fetchStakeAccounts,
  fetchValidators,
  type StakeAccountInfo,
  type ValidatorInfo,
} from '../lib/staking'
import { ACTIVE_CLUSTER_LABEL } from '../lib/rpc-service'
import { solscanTxUrl } from '../lib/explorer'

// ─── Public interfaces ────────────────────────────────────────────────────────

/** Wrapped SOL mint — used to fetch native-SOL metadata from Jupiter. */
export const WRAPPED_SOL_MINT = 'So11111111111111111111111111111111111111112'

export interface Token {
  id: string
  symbol: string
  name: string
  balance: number
  price: number
  change24h: number
  /** CDN icon URL hydrated from the token metadata cache (Jupiter Tokens v2). */
  iconUrl?: string | null
  /** Mint pubkey for SPL tokens; the wrapped-SOL mint for native SOL. */
  mintAddress?: string
  /** Token decimals — needed for atomic↔display conversion in swaps. */
  decimals?: number
  /** Whether Jupiter has verified this token. */
  isVerified?: boolean
  /** Optional metadata tags from Jupiter. */
  tags?: readonly string[]
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

  // Smart Transaction Adjustment: review (build + simulate + analyze) before signing.
  reviewSend: (recipient: string, amountLamports: number, sweepBps: number | null) => Promise<SmartTransactionReview>
  // Submit a send. Runs a MANDATORY simulation, signs, submits, then zeros the key.
  submitSend: (recipient: string, amountLamports: number, sweepBps: number | null) => Promise<TxResult>
  sendSolWithSweep: (recipient: string, amountLamports: number, sweepBps: number) => Promise<TxResult>
  sendSolPlain:     (recipient: string, amountLamports: number) => Promise<TxResult>

  // Native SOL staking
  stakeAccounts:   () => Promise<StakeAccountInfo[]>
  validators:      () => Promise<ValidatorInfo[]>
  stakeSol:        (amountLamports: number, votePubkey: string) => Promise<TxResult>
  deactivateStake: (stakeAddress: string) => Promise<TxResult>
  withdrawStake:   (stakeAddress: string, lamports: number) => Promise<TxResult>

  // Jupiter swap (MAINNET). Sign + simulate + send on the dedicated mainnet conn.
  executeSwap:     (quote: JupiterQuote) => Promise<TxResult>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

function mapHolding(h: TokenHolding): Token {
  const isNative = h.assetKind === 'native-sol'
  return {
    id:          isNative ? 'sol' : h.mintAddress,
    mintAddress: isNative ? WRAPPED_SOL_MINT : h.mintAddress,
    symbol:      h.symbol,
    name:        h.name,
    balance:     parseFloat(h.amountDisplay.replace(/,/g, '')) || 0,
    price:       h.usdPrice ?? 0,
    change24h:   h.dailyChangePercentage,
    decimals:    h.decimals,
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
  return solscanTxUrl(sig)
}

/**
 * Reads cached metadata for each token, then refreshes anything missing from
 * Jupiter. Returns a new array of Tokens with `iconUrl`, `isVerified`, and
 * `tags` populated, or `null` if nothing changed (so callers can skip a
 * re-render).
 */
async function hydrateTokenMetadata(tokens: Token[]): Promise<Token[] | null> {
  const mints = tokens.map(t => t.mintAddress).filter((m): m is string => !!m)
  if (mints.length === 0) return null

  const cached = await tokenMetadataCache.readMany(mints)
  let changed = false

  const enriched = tokens.map(t => {
    if (!t.mintAddress) return t
    const meta = cached.get(t.mintAddress)
    if (!meta) return t
    if (t.iconUrl === meta.icon && t.isVerified === meta.isVerified) return t
    changed = true
    return { ...t, iconUrl: meta.icon, isVerified: meta.isVerified, tags: meta.tags }
  })

  // Background refresh for cache misses; write-through so the next tick is warm.
  const missing = mints.filter(m => !cached.has(m))
  if (missing.length > 0) {
    void jupiterTokensClient.getTokens(missing).then(fetched => {
      void tokenMetadataCache.writeMany([...fetched.values()])
    }).catch(() => { /* swallow — non-critical */ })
  }

  return changed ? enriched : null
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WalletContext = createContext<WalletContextType | undefined>(undefined)

const REFRESH_MS = 30_000
const DEFAULT_AUTO_YIELD = createDefaultAutoYieldState()

/** One-time rent paid by the owner to create their vault PDA on the first
 *  sweep send (~0.0013 SOL). Reserved so a "Max"/adjusted sweep send leaves
 *  enough to cover it. */
const VAULT_CREATION_RENT_LAMPORTS = 1_300_000

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
    label: ACTIVE_CLUSTER_LABEL, isHealthy: true, latencyMs: null,
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
        fetchOnChainVaultState(kitRpc, address).catch(() => null),
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

      // Hydrate icon + metadata from cache, then refresh missing entries from
      // Jupiter in the background. Re-renders the token list with iconUrl filled.
      void hydrateTokenMetadata(mappedTokens).then(enriched => {
        if (enriched) setTokens(enriched)
      })
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

  /** The 64-byte session secret as a fresh copy (the session vault keeps its own).
   *  Handed to the Kit signing pipeline, which imports it into a non-extractable
   *  WebCrypto key and zeros this copy after signing (ADR-0005, CLAUDE.md §5). */
  function requireSecret(): Uint8Array {
    const secret = loadSecret()
    if (!secret) throw new Error('Wallet locked — please import your wallet to sign transactions.')
    return secret
  }

  function txResult(sig: string): TxResult {
    return { signature: sig, explorerUrl: explorerUrl(sig) }
  }

  // ── On-chain actions (vault signing via the Kit pipeline — ADR-0005) ─────────

  const initializeVault = useCallback(async (): Promise<TxResult> => {
    const mint = resolveStableMint(connection)
    const sig = await kitSigner.initializeAutoYield(requireSecret(), mint.toBase58())
    setVault(v => ({ ...v, initialized: true, isActive: true }))
    await fetchDashboard()
    return txResult(sig)
  }, [fetchDashboard])

  const pauseVault = useCallback(async (): Promise<TxResult> => {
    const sig = await kitSigner.pauseAutoYield(requireSecret())
    setVault(v => ({ ...v, isActive: false }))
    await fetchDashboard()
    return txResult(sig)
  }, [fetchDashboard])

  const resumeVault = useCallback(async (): Promise<TxResult> => {
    const sig = await kitSigner.resumeAutoYield(requireSecret())
    setVault(v => ({ ...v, isActive: true }))
    await fetchDashboard()
    return txResult(sig)
  }, [fetchDashboard])

  const updateVaultConfig = useCallback(async (args: {
    enabled: boolean; sweepMode: number; percentageBps: number
    roundUpUnitLamports: number; deployThresholdAtomic: number
  }): Promise<TxResult> => {
    // Fetch current on-chain config to fill unchanged fields (read stays on v1).
    const addr = localStorage.getItem(WALLET_ADDRESS_KEY)!
    const state = await fetchOnChainVaultState(kitRpc, addr)
    const current = state.config
    const sig = await kitSigner.updateAutoYieldConfig(requireSecret(), {
      enabled:               args.enabled,
      paused:                current?.paused ?? false,
      sweepMode:             args.sweepMode,
      roundUpUnitLamports:   BigInt(args.roundUpUnitLamports),
      percentageBps:         args.percentageBps,
      deployThresholdAtomic: BigInt(args.deployThresholdAtomic),
      activeProtocol:        current?.activeProtocol ?? 0,
      allowedProtocolsMask:  current?.allowedProtocolsMask ?? 1,
      excludedProtocolsMask: current?.excludedProtocolsMask ?? 0,
    })
    await fetchDashboard()
    return txResult(sig)
  }, [fetchDashboard])

  const addFundsToVault = useCallback(async (amountLamports: number): Promise<TxResult> => {
    const sig = await kitSigner.sweepSol(requireSecret(), amountLamports)
    await fetchDashboard()
    return txResult(sig)
  }, [fetchDashboard])

  const withdrawFromVault = useCallback(async (amountLamports: number): Promise<TxResult> => {
    const addr = localStorage.getItem(WALLET_ADDRESS_KEY)!
    const state = await fetchOnChainVaultState(kitRpc, addr)
    // Use the AutoYield-aware withdraw if the vault is initialized, otherwise direct
    const sig = state.initialized
      ? await kitSigner.withdrawSol(requireSecret(), amountLamports)
      : await kitSigner.withdrawVaultSol(requireSecret(), amountLamports)
    await fetchDashboard()
    return txResult(sig)
  }, [fetchDashboard])

  /** Extra SOL the engine must reserve on a vault-sweep send so the "adjusted"
   *  amount is actually sendable: the one-time vault PDA rent (first send only)
   *  plus the swept fraction of the amount. */
  const sweepReserveLamports = useCallback((amountLamports: number, sweepBps: number | null): number => {
    if (sweepBps === null) return 0
    const vaultRent = vault.initialized ? 0 : VAULT_CREATION_RENT_LAMPORTS
    const sweep = Math.ceil((amountLamports * sweepBps) / 10_000)
    return vaultRent + sweep
  }, [vault.initialized])

  /** Build + simulate + analyze a send WITHOUT signing — drives the Smart
   *  Adjustment review card before the user confirms. */
  const reviewSend = useCallback(async (
    recipient: string, amountLamports: number, sweepBps: number | null,
  ): Promise<SmartTransactionReview> => {
    const owner = localStorage.getItem(WALLET_ADDRESS_KEY)
    if (!owner) throw new Error('No wallet address — import or create a wallet first.')
    const solUsdPrice = tokens.find(t => t.id === 'sol')?.price ?? null
    return reviewNativeSolSend({
      connection, kitSigner, owner, recipient, amountLamports, sweepBps, solUsdPrice,
      extraReserveLamports: sweepReserveLamports(amountLamports, sweepBps),
    })
  }, [tokens, sweepReserveLamports])

  /** Submit a send via the Kit pipeline (ADR-0005): build → MANDATORY fail-closed
   *  simulate → (priority-fee CU sizing + re-simulate) → sign with a non-extractable
   *  WebCrypto signer → send → MV3 poll-confirm → zero the secret. All the §5
   *  mandates are enforced inside `kitSigner`. */
  const submitSend = useCallback(async (
    recipient: string, amountLamports: number, sweepBps: number | null,
  ): Promise<TxResult> => {
    const secret = requireSecret()
    // Per-CU priority-fee price from recent on-chain prioritization fees (a read);
    // the pipeline sizes the CU limit from its own simulation.
    const priorityFeeMicroLamports = await resolvePriorityFeeMicroLamportsPerCu(connection)
    const sig = sweepBps !== null
      ? await kitSigner.sendSol(secret, recipient, amountLamports, sweepBps, priorityFeeMicroLamports)
      : await kitSigner.sendSolPlain(secret, recipient, amountLamports, priorityFeeMicroLamports)
    await fetchDashboard()
    return txResult(sig)
  }, [fetchDashboard])

  const sendSolWithSweep = useCallback((
    recipient: string, amountLamports: number, sweepBps: number,
  ): Promise<TxResult> => submitSend(recipient, amountLamports, sweepBps), [submitSend])

  const sendSolPlain = useCallback((
    recipient: string, amountLamports: number,
  ): Promise<TxResult> => submitSend(recipient, amountLamports, null), [submitSend])

  // ── Native staking ──────────────────────────────────────────────────────────

  const stakeAccounts = useCallback((): Promise<StakeAccountInfo[]> => {
    const owner = localStorage.getItem(WALLET_ADDRESS_KEY)
    return owner ? fetchStakeAccounts(kitRpc, owner) : Promise.resolve([])
  }, [])

  const validators = useCallback((): Promise<ValidatorInfo[]> =>
    fetchValidators(kitRpc, 25), [])

  // Staking signing now runs on the Kit pipeline (`stakeSigner`): each op builds →
  // fail-closed simulates → signs (owner + ephemeral stake account) → sends → MV3
  // poll-confirms → zeros the secret, exactly like the vault + send flows.

  const stakeSol = useCallback(async (amountLamports: number, votePubkey: string): Promise<TxResult> => {
    const sig = await stakeSigner.stakeAndDelegate(requireSecret(), amountLamports, votePubkey)
    await fetchDashboard()
    return txResult(sig)
  }, [fetchDashboard])

  const deactivateStake = useCallback(async (stakeAddress: string): Promise<TxResult> => {
    const sig = await stakeSigner.deactivateStake(requireSecret(), stakeAddress)
    await fetchDashboard()
    return txResult(sig)
  }, [fetchDashboard])

  const withdrawStake = useCallback(async (stakeAddress: string, lamports: number): Promise<TxResult> => {
    const sig = await stakeSigner.withdrawStake(requireSecret(), stakeAddress, lamports)
    await fetchDashboard()
    return txResult(sig)
  }, [fetchDashboard])

  // ── Jupiter swap (MAINNET) ────────────────────────────────────────────────────

  /** Fetch Jupiter's swap tx for a quote, MANDATORY-simulate it (fail-closed) on
   *  the mainnet connection, sign, send, and zero the key. */
  const executeSwap = useCallback(async (quote: JupiterQuote): Promise<TxResult> => {
    const kp = requireKeypair()
    const swap = await jupiterSwapClient.getSwapTransaction({
      quote, userPublicKey: kp.publicKey.toBase58(),
    })
    const vtx = deserializeSwapTransaction(swap.swapTransactionBase64)
    const sim = await simulateSwap(swapConnection, vtx)
    if (!sim.ok) {
      zeroKeypairSecret(kp)
      throw new Error(`Swap simulation blocked this transaction: ${sim.reason}`)
    }
    const sig = await signSendSwap(swapConnection, vtx, kp, swap.lastValidBlockHeight)
    // Swaps execute on mainnet — link to the mainnet explorer (no cluster param).
    return { signature: sig, explorerUrl: `https://solscan.io/tx/${sig}` }
  }, [])

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
      fullAddress: addr, shortAddress: short, address: addr,
      name: walletLabel, tokens, totalBalanceUsd, vault,
      loading, error, network, hasKeypair,
      refresh, setWalletAddress,
      updateVault, updateVaultRule,
      initializeVault,
      pauseVault, resumeVault, updateVaultConfig,
      addFundsToVault, withdrawFromVault,
      reviewSend, submitSend, sendSolWithSweep, sendSolPlain,
      stakeAccounts, validators, stakeSol, deactivateStake, withdrawStake,
      executeSwap,
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
