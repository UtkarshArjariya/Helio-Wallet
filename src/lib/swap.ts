/**
 * Jupiter swap execution (MAINNET) — deserialize, simulate, sign, send.
 *
 * Jupiter's /swap returns a base64 **v0 VersionedTransaction** carrying Address
 * Lookup Tables and (when SOL is involved) pre-signed ephemeral WSOL signers —
 * so we must NOT replace its blockhash. We still honor Helio's mandatory
 * pre-send simulation (fail-closed) and per-signing key zeroing.
 */

import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js'
import { decodeBase64 } from '../shared/base64'
import { zeroKeypairSecret } from './helio-program'

/** Deserialize Jupiter's base64 v0 swap transaction. */
export function deserializeSwapTransaction(base64: string): VersionedTransaction {
  return VersionedTransaction.deserialize(decodeBase64(base64))
}

function describeErr(err: unknown, logs: readonly string[] | null): string {
  const tail = (logs ?? []).slice(-3).join(' · ')
  const raw = typeof err === 'string' ? err : JSON.stringify(err)
  return tail ? `${raw} — ${tail}` : raw
}

/**
 * Mandatory pre-send simulation of a Jupiter swap (fail-closed).
 *
 * Uses `replaceRecentBlockhash: true, sigVerify: false` so simulation doesn't
 * fail on the not-yet-final blockhash; this does NOT mutate the signed tx.
 *
 * @returns `{ ok: true }` when clean, else `{ ok: false, reason }`. An RPC
 *   failure to simulate is treated as `ok: false` (do not send blind).
 */
export async function simulateSwap(
  connection: Connection,
  vtx: VersionedTransaction,
): Promise<{ ok: boolean; reason: string | null }> {
  try {
    const res = await connection.simulateTransaction(vtx, {
      replaceRecentBlockhash: true,
      sigVerify: false,
      commitment: 'processed',
    })
    if (!res.value.err) return { ok: true, reason: null }
    return { ok: false, reason: describeErr(res.value.err, res.value.logs) }
  } catch (err: any) {
    return {
      ok: false,
      reason: `Could not simulate the swap (${err?.message ?? 'RPC error'}). It was not sent — try again.`,
    }
  }
}

/**
 * Sign + send + confirm a (already-simulated) swap transaction, then zero the
 * signing key. Does NOT touch the blockhash (preserves Jupiter's embedded
 * ephemeral signers).
 *
 * @returns The transaction signature.
 */
export async function signSendSwap(
  connection: Connection,
  vtx: VersionedTransaction,
  keypair: Keypair,
  lastValidBlockHeight: number,
): Promise<string> {
  try {
    vtx.sign([keypair])
    const sig = await connection.sendRawTransaction(vtx.serialize(), {
      skipPreflight: true, // already simulated above
      maxRetries: 2,
    })
    await connection.confirmTransaction(
      { signature: sig, blockhash: vtx.message.recentBlockhash, lastValidBlockHeight },
      'confirmed',
    )
    return sig
  } finally {
    zeroKeypairSecret(keypair)
  }
}
