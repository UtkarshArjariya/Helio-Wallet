/**
 * In-worker dApp request handler (the live-tree fix).
 *
 * The background service worker receives Wallet-Standard connect/sign requests
 * from web pages. This handler resolves them using the SHIPPED wallet's session
 * secret (`chrome.storage.session["helio:secret"]`, written by
 * `src/lib/secret-store.ts`) — signing happens entirely inside the worker, the
 * popup only ever sends an approve/reject decision (it never sees the key).
 *
 * It deliberately bypasses `extension-service.ts`, whose dApp path reads a
 * separate `extension-storage` wallet that onboarding never populates (the
 * cause of the 60s approval timeout).
 *
 * SECURITY: the secret never leaves the worker; the key is zeroed in a `finally`
 * after every signing op; origins are wallet-verified by `assertTrustedSender`
 * in `background.ts` before reaching here.
 */

import { Keypair } from '@solana/web3.js'
import { HelioCoreError, signMessageWithSecretKey } from '@helio/core'
import { createLocalDappRiskProvider } from '@helio/api'
import type {
  ConnectDappRequest,
  DappApprovedRequestResult,
  DappConnectionState,
  DappOriginRequest,
  DappRequestDecisionResult,
  PendingDappRequest,
  RequestDappMessageSignatureRequest,
  RequestDappTransactionSignatureRequest,
  WalletAccountSummary,
} from '@helio/types'
import { signSerializedDappTransaction } from './extension-service'
import { decodeBase64, encodeBase64 } from '../shared/base64'

const SECRET_STORAGE_KEY = 'helio:secret'
const TRUSTED_ORIGINS_KEY = 'helio:trusted-origins'

const DAPP_REQUEST_TYPES = new Set<string>([
  'helio/connect-dapp',
  'helio/disconnect-dapp',
  'helio/get-dapp-connection-state',
  'helio/get-pending-dapp-request',
  'helio/sign-dapp-transaction',
  'helio/sign-dapp-message',
  'helio/approve-dapp-request',
  'helio/reject-dapp-request',
])

const riskProvider = createLocalDappRiskProvider()

/** The single in-flight pending request (in-memory, like the parked response). */
let pendingDappRequest: PendingDappRequest | null = null

function hasChromeSession(): boolean {
  return typeof chrome !== 'undefined' && !!chrome?.storage?.session
}

async function readSessionSecret(): Promise<Uint8Array | null> {
  if (!hasChromeSession()) return null
  try {
    const out = await chrome.storage.session.get(SECRET_STORAGE_KEY)
    const stored = out[SECRET_STORAGE_KEY] as string | undefined
    if (stored) return Uint8Array.from(JSON.parse(stored))
  } catch { /* corrupt/missing */ }
  return null
}

/** Reconstruct the keypair, run `fn`, then zero every copy of the secret. */
async function withSessionKeypair<T>(fn: (keypair: Keypair) => Promise<T> | T): Promise<T> {
  const secret = await readSessionSecret()
  if (!secret) {
    throw new HelioCoreError('Unlock Helio to approve this request.', 'SESSION_LOCKED')
  }
  const keypair = Keypair.fromSecretKey(secret)
  try {
    return await fn(keypair)
  } finally {
    try {
      (keypair as unknown as { _keypair?: { secretKey?: Uint8Array } })._keypair?.secretKey?.fill(0)
    } catch { /* best-effort */ }
    secret.fill(0)
  }
}

async function sessionPublicKey(): Promise<string | null> {
  const secret = await readSessionSecret()
  if (!secret) return null
  try {
    return Keypair.fromSecretKey(secret).publicKey.toBase58()
  } catch {
    return null
  } finally {
    secret.fill(0)
  }
}

async function readTrustedOrigins(): Promise<string[]> {
  if (!hasChromeSession()) return []
  try {
    const out = await chrome.storage.session.get(TRUSTED_ORIGINS_KEY)
    const value = out[TRUSTED_ORIGINS_KEY]
    return Array.isArray(value) ? (value as string[]) : []
  } catch {
    return []
  }
}

async function addTrustedOrigin(origin: string): Promise<void> {
  const origins = await readTrustedOrigins()
  if (!origins.includes(origin) && hasChromeSession()) {
    await chrome.storage.session.set({ [TRUSTED_ORIGINS_KEY]: [...origins, origin] })
  }
}

async function removeTrustedOrigin(origin: string): Promise<void> {
  const origins = await readTrustedOrigins()
  if (hasChromeSession()) {
    await chrome.storage.session.set({ [TRUSTED_ORIGINS_KEY]: origins.filter((o) => o !== origin) })
  }
}

function normalizeOrigin(origin: string): string {
  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    throw new HelioCoreError('The dApp origin is not a valid URL.', 'INVALID_DAPP_ORIGIN')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new HelioCoreError('Only http(s) dApp origins are supported.', 'INVALID_DAPP_ORIGIN')
  }
  return parsed.origin
}

function accountSummary(address: string): WalletAccountSummary {
  return {
    address,
    label: 'Main Wallet',
    derivationIndex: 0,
    kind: 'imported',
    shortAddress: `${address.slice(0, 4)}…${address.slice(-4)}`,
  }
}

function requestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `helio-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`
}

function pendingApprovalError(id: string): HelioCoreError {
  return new HelioCoreError('Review this request in Helio before continuing.', 'DAPP_APPROVAL_REQUIRED', { requestId: id })
}

const MAX_PREVIEW_BYTES = 1024

function messagePreview(messageBase64: string): string {
  try {
    const allBytes = decodeBase64(messageBase64)
    // Only decode a bounded prefix for the preview so a multi-MB message can't
    // force a huge allocation/scan in the worker.
    const bytes = allBytes.length > MAX_PREVIEW_BYTES ? allBytes.slice(0, MAX_PREVIEW_BYTES) : allBytes
    const text = new TextDecoder().decode(bytes)
    let readable = text.length > 0
    for (const ch of text) {
      const code = ch.codePointAt(0) ?? 0
      // Control chars (excluding tab/newline/carriage-return) mark a binary blob.
      if ((code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31)) {
        readable = false
        break
      }
    }
    return readable ? text.slice(0, 280) : `[Binary message: ${allBytes.length} bytes]`
  } catch {
    return '[Unreadable message]'
  }
}

async function handleConnect(request: ConnectDappRequest): Promise<DappConnectionState> {
  const origin = normalizeOrigin(request.origin)
  const publicKey = await sessionPublicKey()
  if (!publicKey) throw new HelioCoreError('Unlock Helio to connect this site.', 'SESSION_LOCKED')

  if ((await readTrustedOrigins()).includes(origin)) {
    return { origin, isConnected: true, account: accountSummary(publicKey) }
  }

  const risk = await riskProvider.assessConnection({ iconUrl: request.iconUrl ?? null, name: request.name, origin })
  pendingDappRequest = {
    kind: 'connect',
    id: requestId(),
    requestedAtIso: new Date().toISOString(),
    dapp: {
      name: request.name?.trim() || new URL(origin).hostname,
      origin,
      iconUrl: request.iconUrl ?? null,
      trustLevel: risk.trustLevel,
    },
    permissions: ['connect'],
    warnings: risk.warnings,
  }
  throw pendingApprovalError(pendingDappRequest.id)
}

async function handleSignTransaction(request: RequestDappTransactionSignatureRequest): Promise<never> {
  const origin = normalizeOrigin(request.origin)
  if (!(await sessionPublicKey())) throw new HelioCoreError('Unlock Helio to sign.', 'SESSION_LOCKED')

  const risk = await riskProvider.assessTransaction({
    iconUrl: request.iconUrl ?? null,
    name: request.name,
    origin,
    programAddresses: [],
    serializedTransactionBase64: request.serializedTransactionBase64,
    summaryLines: ['This site is requesting your signature on a transaction.'],
  })
  const id = requestId()
  const dapp = {
    name: request.name?.trim() || new URL(origin).hostname,
    origin,
    iconUrl: request.iconUrl ?? null,
    trustLevel: risk.trustLevel,
  }
  pendingDappRequest = {
    kind: 'sign-transaction',
    id,
    requestedAtIso: new Date().toISOString(),
    dapp,
    review: {
      requestId: id,
      dapp,
      summaryLines: ['This site is requesting your signature on a transaction.'],
      warnings: risk.warnings,
      sendReview: null,
    },
    serializedTransactionBase64: request.serializedTransactionBase64,
  }
  throw pendingApprovalError(id)
}

async function handleSignMessage(request: RequestDappMessageSignatureRequest): Promise<never> {
  const origin = normalizeOrigin(request.origin)
  if (!(await sessionPublicKey())) throw new HelioCoreError('Unlock Helio to sign.', 'SESSION_LOCKED')

  const preview = messagePreview(request.messageBase64)
  const risk = await riskProvider.assessMessage({
    iconUrl: request.iconUrl ?? null,
    name: request.name,
    origin,
    messageBase64: request.messageBase64,
    messagePreview: preview,
  })
  const id = requestId()
  pendingDappRequest = {
    kind: 'sign-message',
    id,
    requestedAtIso: new Date().toISOString(),
    dapp: {
      name: request.name?.trim() || new URL(origin).hostname,
      origin,
      iconUrl: request.iconUrl ?? null,
      trustLevel: risk.trustLevel,
    },
    messageBase64: request.messageBase64,
    messagePreview: preview,
    summaryLines: [`Message preview: ${preview}`, 'Only sign if you trust this site.'],
    warnings: risk.warnings,
  }
  throw pendingApprovalError(id)
}

async function handleApprove(id: string): Promise<DappApprovedRequestResult> {
  const request = pendingDappRequest
  if (!request || request.id !== id) {
    throw new HelioCoreError('The dApp request could not be found.', 'DAPP_REQUEST_NOT_FOUND')
  }

  if (request.kind === 'connect') {
    // Derive the pubkey (confirm unlocked) BEFORE trusting the origin, so a
    // locked wallet can never half-connect a site.
    const publicKey = await sessionPublicKey()
    if (!publicKey) throw new HelioCoreError('Unlock Helio to connect this site.', 'SESSION_LOCKED')
    await addTrustedOrigin(request.dapp.origin)
    pendingDappRequest = null
    return {
      kind: 'connect',
      requestId: id,
      connectionState: {
        origin: request.dapp.origin,
        isConnected: true,
        account: accountSummary(publicKey),
      },
    }
  }

  if (request.kind === 'sign-transaction') {
    const signedTransaction = await withSessionKeypair(async (keypair) => {
      const secretKey = keypair.secretKey // getter returns a fresh copy
      try {
        return await signSerializedDappTransaction({
          senderSecretKey: secretKey,
          serializedTransactionBase64: request.serializedTransactionBase64,
        })
      } finally {
        try { secretKey.fill(0) } catch { /* best-effort */ }
      }
    })
    pendingDappRequest = null
    return { kind: 'sign-transaction', requestId: id, signedTransaction }
  }

  // sign-message — derive pubkey + signature inside the keypair scope so a
  // locked wallet throws SESSION_LOCKED rather than returning an empty pubkey.
  const signed = await withSessionKeypair(async (keypair) => {
    const publicKey = keypair.publicKey.toBase58()
    const signature = await signMessageWithSecretKey(decodeBase64(request.messageBase64), keypair.secretKey)
    return { publicKey, signatureBase64: encodeBase64(signature) }
  })
  pendingDappRequest = null
  return {
    kind: 'sign-message',
    requestId: id,
    signedMessage: {
      publicKey: signed.publicKey,
      signatureBase64: signed.signatureBase64,
      signedMessageBase64: request.messageBase64,
    },
  }
}

function handleReject(id: string): DappRequestDecisionResult {
  if (pendingDappRequest?.id === id) pendingDappRequest = null
  return { requestId: id }
}

async function handleConnectionState(request: DappOriginRequest): Promise<DappConnectionState> {
  const origin = normalizeOrigin(request.origin)
  const connected = (await readTrustedOrigins()).includes(origin)
  const publicKey = connected ? await sessionPublicKey() : null
  return { origin, isConnected: connected && publicKey !== null, account: publicKey ? accountSummary(publicKey) : null }
}

async function handleDisconnect(request: DappOriginRequest): Promise<DappConnectionState> {
  const origin = normalizeOrigin(request.origin)
  await removeTrustedOrigin(origin)
  if (pendingDappRequest?.dapp.origin === origin) pendingDappRequest = null
  return { origin, isConnected: false, account: null }
}

export interface DappHandler {
  /** Whether a request type is a dApp verb this handler owns. */
  isDappRequest(type: string): boolean
  /** Whether a type is an approve/reject decision (resolves a parked request). */
  isDecision(type: string): boolean
  handle(type: string, payload: unknown): Promise<unknown>
}

/** Create the background worker's dApp request handler. */
export function createDappHandler(): DappHandler {
  return {
    isDappRequest: (type) => DAPP_REQUEST_TYPES.has(type),
    isDecision: (type) => type === 'helio/approve-dapp-request' || type === 'helio/reject-dapp-request',
    async handle(type, payload) {
      switch (type) {
        case 'helio/get-pending-dapp-request':
          return pendingDappRequest
        case 'helio/connect-dapp':
          return handleConnect(payload as ConnectDappRequest)
        case 'helio/sign-dapp-transaction':
          return handleSignTransaction(payload as RequestDappTransactionSignatureRequest)
        case 'helio/sign-dapp-message':
          return handleSignMessage(payload as RequestDappMessageSignatureRequest)
        case 'helio/get-dapp-connection-state':
          return handleConnectionState(payload as DappOriginRequest)
        case 'helio/disconnect-dapp':
          return handleDisconnect(payload as DappOriginRequest)
        case 'helio/approve-dapp-request':
          return handleApprove((payload as DappRequestDecisionResult).requestId)
        case 'helio/reject-dapp-request':
          return handleReject((payload as DappRequestDecisionResult).requestId)
        default:
          throw new HelioCoreError(`Unknown dApp request: ${type}`, 'UNSUPPORTED_VAULT_OPERATION')
      }
    },
  }
}
