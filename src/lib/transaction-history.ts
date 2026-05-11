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
import bs58 from 'bs58'
import {
  Connection, LAMPORTS_PER_SOL, PublicKey,
  type ConfirmedSignatureInfo, type ParsedTransactionWithMeta,
  type ParsedInstruction, type PartiallyDecodedInstruction,
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

/* ── Helio instruction discriminators (8-byte prefix on Anchor ix data) ─── */

/** Map first-8-byte instruction prefix → instruction name. The names mirror
 *  anchor/target/idl/helio.json verbatim. */
const HELIO_DISCRIMINATORS: { name: HelioIx; bytes: number[] }[] = [
  { name: 'close_empty_reserve',      bytes: [136, 48, 94, 98, 100, 148, 204, 7] },
  { name: 'initialize_auto_yield',    bytes: [251, 132, 53, 164, 110, 171, 181, 23] },
  { name: 'pause_auto_yield',         bytes: [211, 43, 244, 12, 113, 41, 221, 214] },
  { name: 'resume_auto_yield',        bytes: [214, 119, 163, 153, 185, 215, 243, 65] },
  { name: 'send_sol',                 bytes: [214, 24, 219, 18, 3, 205, 201, 179] },
  { name: 'sweep_sol',                bytes: [48, 81, 27, 227, 28, 145, 224, 204] },
  { name: 'sweep_stable',             bytes: [74, 168, 179, 44, 42, 24, 113, 118] },
  { name: 'update_auto_yield_config', bytes: [36, 48, 204, 198, 62, 156, 39, 92] },
  { name: 'withdraw_sol',             bytes: [145, 131, 74, 136, 65, 137, 42, 38] },
  { name: 'withdraw_stable',          bytes: [91, 237, 76, 210, 121, 146, 161, 93] },
  { name: 'withdraw_vault_sol',       bytes: [3, 23, 239, 50, 93, 233, 102, 85] },
]

type HelioIx =
  | 'close_empty_reserve'
  | 'initialize_auto_yield'
  | 'pause_auto_yield'
  | 'resume_auto_yield'
  | 'send_sol'
  | 'sweep_sol'
  | 'sweep_stable'
  | 'update_auto_yield_config'
  | 'withdraw_sol'
  | 'withdraw_stable'
  | 'withdraw_vault_sol'

/** UI metadata per Helio instruction. */
const HELIO_IX_META: Record<HelioIx, { kind: ActivityKind; title: string; subtitle: string }> = {
  initialize_auto_yield:    { kind: 'vault-deploy',   title: 'Vault created',        subtitle: 'Auto-yield initialised' },
  pause_auto_yield:         { kind: 'vault-deploy',   title: 'Vault paused',         subtitle: 'Round-ups halted' },
  resume_auto_yield:        { kind: 'vault-deploy',   title: 'Vault resumed',        subtitle: 'Round-ups re-enabled' },
  update_auto_yield_config: { kind: 'vault-deploy',   title: 'Vault rules updated',  subtitle: 'Config changed' },
  send_sol:                 { kind: 'send',           title: 'Sent SOL + round-up',  subtitle: 'Helio send w/ vault sweep' },
  sweep_sol:                { kind: 'vault-roundup',  title: 'Vault deposit',        subtitle: 'Swept into SOL reserve' },
  sweep_stable:             { kind: 'vault-roundup',  title: 'Stable vault deposit', subtitle: 'Swept into stable reserve' },
  withdraw_sol:             { kind: 'vault-withdraw', title: 'Vault withdrawal',     subtitle: 'SOL back to wallet' },
  withdraw_vault_sol:       { kind: 'vault-withdraw', title: 'Vault withdrawal',     subtitle: 'Reserve → wallet' },
  withdraw_stable:          { kind: 'vault-withdraw', title: 'Stable withdrawal',    subtitle: 'Stable reserve → wallet' },
  close_empty_reserve:      { kind: 'vault-deploy',   title: 'Reserve closed',       subtitle: 'Empty reserve account closed' },
}

/** Decode an Anchor instruction's first 8 bytes and look up its name. */
function decodeHelioInstruction(
  ix: ParsedInstruction | PartiallyDecodedInstruction,
): HelioIx | null {
  // Only PartiallyDecodedInstruction has raw base58 `data`. Parsed system /
  // token / etc. instructions never match Helio anyway.
  if (!('data' in ix) || typeof ix.data !== 'string') return null
  let raw: Uint8Array
  try { raw = bs58.decode(ix.data) } catch { return null }
  if (raw.length < 8) return null

  for (const entry of HELIO_DISCRIMINATORS) {
    let match = true
    for (let i = 0; i < 8; i++) {
      if (raw[i] !== entry.bytes[i]) { match = false; break }
    }
    if (match) return entry.name
  }
  return null
}

/** Find the first Helio instruction in a transaction (top-level or inner). */
function findHelioIx(tx: ParsedTransactionWithMeta): HelioIx | null {
  const helioProgramId = HELIO_PROGRAM_ID.toString()
  for (const ix of tx.transaction.message.instructions) {
    if ('programId' in ix && ix.programId.toString() === helioProgramId) {
      const name = decodeHelioInstruction(ix)
      if (name) return name
    }
  }
  for (const block of tx.meta?.innerInstructions ?? []) {
    for (const ix of block.instructions) {
      if ('programId' in ix && ix.programId.toString() === helioProgramId) {
        const name = decodeHelioInstruction(ix)
        if (name) return name
      }
    }
  }
  return null
}

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

  // Helio program — decode the instruction discriminator so we can label the
  // row by what the user *did* (created vault, paused, deposit, withdraw,
  // sent-with-roundup, etc.) instead of the coarse-grained delta heuristic.
  if (isHelio) {
    const ixName = findHelioIx(tx)
    if (ixName) {
      const meta = HELIO_IX_META[ixName]
      const amount =
        Math.abs(solDelta) > 0.0000001
          ? `${solDelta > 0 ? '+' : ''}${solDelta.toFixed(4)} SOL`
          : ''
      const positive =
        meta.kind === 'vault-roundup'   ? false      // outflow from wallet → vault
        : meta.kind === 'vault-withdraw' ? true      // inflow from vault → wallet
        : meta.kind === 'send'           ? false
        : solDelta > 0                    ? true
        : solDelta < 0                    ? false
        : undefined
      return {
        id: sig.signature,
        kind: meta.kind,
        date,
        title:    meta.title,
        subtitle: meta.subtitle,
        amount,
        positive,
      }
    }
    // Unrecognised Helio ix → still mark as vault-related rather than misfile.
    const positive = solDelta > 0
    return {
      id: sig.signature,
      kind:     positive ? 'vault-reward' : 'vault-roundup',
      date,
      title:    'Vault transaction',
      subtitle: 'Helio program',
      amount:   `${positive ? '+' : ''}${solDelta.toFixed(4)} SOL`,
      positive,
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

/** Bounded-concurrency Promise.all replacement. Workers race a shared cursor
 *  so we never have more than `limit` requests in flight at once — safer on
 *  free-tier RPC endpoints than firing N concurrent fetches. */
async function pMapLimit<T, R>(
  items: T[], limit: number, fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      out[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return out
}

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

  // IMPORTANT: web3.js' getParsedTransactions (plural) sends a JSON-RPC batch,
  // which Helius / QuikNode free tiers reject (-32403). Fan out one request
  // per signature with bounded concurrency so we work on every RPC plan.
  const txs = await pMapLimit(sigs, 5, sig =>
    conn.getParsedTransaction(sig.signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    }).catch(() => null),
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
