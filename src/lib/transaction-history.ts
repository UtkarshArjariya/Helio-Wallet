/**
 * Solana transaction history → ActivityItem[].
 *
 * Fetches recent signatures for the owner, parses each transaction, and
 * classifies it into a human-readable activity row. Used by HomeScreen
 * (recent slice) and ActivityScreen (full list).
 *
 * Classification is best-effort — we look at:
 *   1. The owner's net SOL balance delta (send vs receive)
 *   2. The set of programs invoked (Helio, Jupiter, Stake, SPL Token)
 *   3. SPL token balance deltas for the owner's ATAs
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Connection, LAMPORTS_PER_SOL, PublicKey,
  type ConfirmedSignatureInfo, type ParsedTransactionWithMeta,
} from '@solana/web3.js'
import type { ActivityItem, ActivityKind } from '../components/wallet/ui/ActivityRow'
import { connection } from './rpc-service'
import { HELIO_PROGRAM_ID } from './helio-program'

const SYSTEM_PROGRAM      = '11111111111111111111111111111111'
const TOKEN_PROGRAM       = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
const TOKEN_2022_PROGRAM  = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
const STAKE_PROGRAM       = 'Stake11111111111111111111111111111111111111'
// Jupiter v6 aggregator
const JUPITER_AGGREGATOR  = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'

const RPC_BATCH_LIMIT = 25

/* ── Helpers ────────────────────────────────────────────────────────────── */

function shortAddr(addr: string | undefined | null): string {
  if (!addr) return ''
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

/** Pull every program id touched by the transaction, including inner ixs. */
function programsTouched(tx: ParsedTransactionWithMeta): Set<string> {
  const ids = new Set<string>()
  const ixs = tx.transaction.message.instructions
  for (const ix of ixs) {
    if ('programId' in ix) ids.add(ix.programId.toString())
  }
  const inner = tx.meta?.innerInstructions ?? []
  for (const block of inner) {
    for (const ix of block.instructions) {
      if ('programId' in ix) ids.add(ix.programId.toString())
    }
  }
  return ids
}

/** Find owner index in the account-keys list. */
function ownerIndex(tx: ParsedTransactionWithMeta, owner: string): number {
  const keys = tx.transaction.message.accountKeys
  for (let i = 0; i < keys.length; i++) {
    const k = typeof keys[i] === 'string' ? keys[i] as unknown as string : keys[i].pubkey.toString()
    if (k === owner) return i
  }
  return -1
}

/** Net SOL delta for owner in this transaction (lamports). Excludes fee
 *  on the fee-payer side so the displayed amount matches user intent. */
function netSolDelta(tx: ParsedTransactionWithMeta, owner: string): number {
  const i = ownerIndex(tx, owner)
  if (i === -1 || !tx.meta) return 0
  const pre  = tx.meta.preBalances[i]  ?? 0
  const post = tx.meta.postBalances[i] ?? 0
  const fee  = tx.transaction.message.accountKeys[i]
    && (typeof tx.transaction.message.accountKeys[i] === 'object')
    && (tx.transaction.message.accountKeys[i] as any).signer
      ? (tx.meta.fee ?? 0)
      : 0
  // Add the fee back so the delta represents the transfer intent.
  return (post - pre) + fee
}

/** Owner-relevant SPL token balance changes — list of (mint, deltaUiAmount). */
interface TokenDelta { mint: string; symbol?: string; delta: number }
function ownerTokenDeltas(tx: ParsedTransactionWithMeta, owner: string): TokenDelta[] {
  const pre  = tx.meta?.preTokenBalances  ?? []
  const post = tx.meta?.postTokenBalances ?? []
  const map = new Map<string, TokenDelta>()
  const add = (mint: string, delta: number) => {
    const cur = map.get(mint) ?? { mint, delta: 0 }
    cur.delta += delta
    map.set(mint, cur)
  }
  for (const b of post) {
    if (b.owner !== owner) continue
    const ui = b.uiTokenAmount.uiAmount ?? 0
    add(b.mint, ui)
  }
  for (const b of pre) {
    if (b.owner !== owner) continue
    const ui = b.uiTokenAmount.uiAmount ?? 0
    add(b.mint, -ui)
  }
  return [...map.values()].filter(d => Math.abs(d.delta) > 0)
}

/** Try to find the system-program transfer counterparty. */
function systemTransferCounterparty(tx: ParsedTransactionWithMeta, owner: string): string | null {
  for (const ix of tx.transaction.message.instructions) {
    if (!('parsed' in ix)) continue
    const parsed = ix.parsed as { type?: string; info?: { source?: string; destination?: string } }
    if (parsed?.type === 'transfer' && parsed.info?.source && parsed.info?.destination) {
      if (parsed.info.source === owner)      return parsed.info.destination
      if (parsed.info.destination === owner) return parsed.info.source
    }
  }
  return null
}

/* ── Classifier ─────────────────────────────────────────────────────────── */

function classify(
  sig: ConfirmedSignatureInfo,
  tx: ParsedTransactionWithMeta,
  owner: string,
): ActivityItem {
  const programs   = programsTouched(tx)
  const solDelta   = netSolDelta(tx, owner) / LAMPORTS_PER_SOL
  const tokens     = ownerTokenDeltas(tx, owner)
  const blockTime  = sig.blockTime ?? Math.floor(Date.now() / 1000)
  const date       = new Date(blockTime * 1000).toISOString()

  const helioProgramId = HELIO_PROGRAM_ID.toString()
  const isHelio   = programs.has(helioProgramId)
  const isJupiter = programs.has(JUPITER_AGGREGATOR)
  const isStake   = programs.has(STAKE_PROGRAM)
  const isToken   = programs.has(TOKEN_PROGRAM) || programs.has(TOKEN_2022_PROGRAM)
  const onlySystem = programs.size === 1 && programs.has(SYSTEM_PROGRAM)

  // Helio program — vault operations
  if (isHelio) {
    const kind: ActivityKind =
      solDelta > 0     ? 'vault-reward'
      : solDelta < 0   ? 'vault-roundup'
      : 'vault-deploy'
    return {
      id: sig.signature,
      kind,
      date,
      title:    solDelta > 0 ? 'Vault reward'
              : solDelta < 0 ? 'Vault deposit'
              : 'Vault deploy',
      subtitle: 'Helio program',
      amount:   `${solDelta > 0 ? '+' : ''}${solDelta.toFixed(4)} SOL`,
      positive: solDelta > 0 ? true : solDelta < 0 ? false : undefined,
    }
  }

  // Jupiter — swap
  if (isJupiter && tokens.length >= 2) {
    const gave = tokens.find(t => t.delta < 0)
    const got  = tokens.find(t => t.delta > 0)
    return {
      id: sig.signature,
      kind: 'swap',
      date,
      title: 'Swap',
      subtitle: gave && got
        ? `${shortAddr(gave.mint)} → ${shortAddr(got.mint)}`
        : 'Jupiter aggregator',
      amount: got
        ? `+${got.delta.toLocaleString('en-US', { maximumFractionDigits: 4 })}`
        : `${solDelta.toFixed(4)} SOL`,
      positive: undefined,
    }
  }

  // Stake program
  if (isStake) {
    return {
      id: sig.signature,
      kind: solDelta < 0 ? 'stake' : 'unstake',
      date,
      title:    solDelta < 0 ? 'Stake' : 'Unstake',
      subtitle: 'Stake program',
      amount:   `${solDelta > 0 ? '+' : ''}${solDelta.toFixed(4)} SOL`,
      positive: solDelta > 0 ? true : false,
    }
  }

  // SPL token transfer (non-Jupiter)
  if (isToken && tokens.length > 0) {
    const moved = tokens[0]
    const positive = moved.delta > 0
    return {
      id: sig.signature,
      kind: positive ? 'receive' : 'send',
      date,
      title:    positive ? 'Received tokens' : 'Sent tokens',
      subtitle: `Mint ${shortAddr(moved.mint)}`,
      amount:   `${positive ? '+' : ''}${moved.delta.toLocaleString('en-US', { maximumFractionDigits: 4 })}`,
      positive,
    }
  }

  // Plain SOL transfer via the System Program
  if (onlySystem || (programs.has(SYSTEM_PROGRAM) && Math.abs(solDelta) > 0.000001)) {
    const counterparty = systemTransferCounterparty(tx, owner)
    const positive = solDelta > 0
    return {
      id: sig.signature,
      kind: positive ? 'receive' : 'send',
      date,
      title:    positive ? 'Received SOL' : 'Sent SOL',
      subtitle: counterparty ? (positive ? `From ${shortAddr(counterparty)}` : `To ${shortAddr(counterparty)}`) : 'SOL transfer',
      amount:   `${positive ? '+' : ''}${solDelta.toFixed(4)} SOL`,
      positive,
    }
  }

  // Unknown — generic transaction row with whatever delta we measured.
  const positive = solDelta > 0
  return {
    id: sig.signature,
    kind: positive ? 'receive' : 'send',
    date,
    title:    sig.err ? 'Failed transaction' : 'Transaction',
    subtitle: `Sig ${shortAddr(sig.signature)}`,
    amount:   `${positive ? '+' : ''}${solDelta.toFixed(4)} SOL`,
    positive: sig.err ? false : positive,
  }
}

/* ── Fetcher ────────────────────────────────────────────────────────────── */

/** Solana base58 address: 32–44 chars, no 0/O/I/l. */
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export async function fetchRecentTransactions(
  conn: Connection,
  address: string,
  limit: number = RPC_BATCH_LIMIT,
): Promise<ActivityItem[]> {
  if (!address) return []
  if (!BASE58_RE.test(address)) {
    // Callers (HomeScreen / ActivityScreen) should be passing fullAddress, not
    // a truncated or ellipsised form. Fail loudly rather than letting the
    // PublicKey constructor throw the cryptic "Non-base58 character" message.
    throw new Error(`Invalid wallet address shape (got "${address.slice(0, 16)}…")`)
  }
  const owner = new PublicKey(address)
  const sigs = await conn.getSignaturesForAddress(owner, { limit })
  if (sigs.length === 0) return []

  const txs = await conn.getParsedTransactions(
    sigs.map(s => s.signature),
    { maxSupportedTransactionVersion: 0 },
  )

  const out: ActivityItem[] = []
  for (let i = 0; i < sigs.length; i++) {
    const tx = txs[i]
    if (!tx) continue
    out.push(classify(sigs[i], tx, address))
  }
  return out
}

/* ── Hook ───────────────────────────────────────────────────────────────── */

interface HookState {
  items:   ActivityItem[]
  loading: boolean
  error:   string | null
}

export function useRecentTransactions(
  address: string | undefined,
  limit: number = RPC_BATCH_LIMIT,
): HookState & { refresh: () => void } {
  const [state, setState] = useState<HookState>({ items: [], loading: false, error: null })

  const refresh = useCallback(async () => {
    if (!address) { setState({ items: [], loading: false, error: null }); return }
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const items = await fetchRecentTransactions(connection, address, limit)
      setState({ items, loading: false, error: null })
    } catch (e: any) {
      setState({ items: [], loading: false, error: e?.message ?? 'Failed to load history.' })
    }
  }, [address, limit])

  useEffect(() => { refresh() }, [refresh])

  return { ...state, refresh }
}
