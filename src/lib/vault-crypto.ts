/**
 * Encrypted-vault primitives.
 *
 * The keypair secret is encrypted client-side with AES-GCM using a key
 * derived from the user's unlock password via PBKDF2-SHA256 (300k iterations).
 *
 * Stored payload (in localStorage at `helio:vault`) is JSON-safe — all binary
 * fields are base64. WebCrypto is used directly so there's no third-party
 * dependency in the encryption path.
 */

/**
 * Vault schema versions:
 *
 *  v1 — ciphertext is the raw 64-byte ed25519 secret key.
 *  v2 — ciphertext is a UTF-8 JSON blob: { phrase: string | null,
 *       secretKey: number[] (64 bytes) }. Lets us export the recovery
 *       phrase later.
 */
export interface EncryptedVault {
  v:            1 | 2
  kdf:          'PBKDF2-SHA256'
  iterations:   number
  salt:         string             // base64 — 16 bytes
  iv:           string             // base64 — 12 bytes (GCM nonce)
  ciphertext:   string             // base64 — payload + GCM tag
  createdAt:    string             // ISO timestamp (informational)
}

export interface DecryptedSecrets {
  secretKey: Uint8Array            // 64-byte ed25519 secret key
  phrase:    string | null         // 12-word BIP-39 mnemonic if recoverable
}

const VAULT_KEY = 'helio:vault'
const PBKDF2_ITERATIONS = 300_000

/* ── base64 ─────────────────────────────────────────────────────────────── */

function bytesToB64(b: Uint8Array): string {
  let s = ''
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
  return btoa(s)
}

function b64ToBytes(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/* ── key derivation ─────────────────────────────────────────────────────── */

async function deriveKey(
  password: string, salt: Uint8Array, iterations: number,
): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const material = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/* ── encrypt / decrypt ──────────────────────────────────────────────────── */

/** v2 — Encrypt a {phrase, secretKey} bundle with the password. */
export async function encryptVault(
  secrets: DecryptedSecrets, password: string,
): Promise<EncryptedVault> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv   = crypto.getRandomValues(new Uint8Array(12))
  const key  = await deriveKey(password, salt, PBKDF2_ITERATIONS)
  const payload = new TextEncoder().encode(JSON.stringify({
    phrase:    secrets.phrase,
    secretKey: Array.from(secrets.secretKey),
  }))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload)
  return {
    v:          2,
    kdf:        'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt:       bytesToB64(salt),
    iv:         bytesToB64(iv),
    ciphertext: bytesToB64(new Uint8Array(ct)),
    createdAt:  new Date().toISOString(),
  }
}

/** Legacy v1 helper — used by import flows that don't have a phrase. */
export async function encryptSecret(
  secretKey: Uint8Array, password: string,
): Promise<EncryptedVault> {
  return encryptVault({ secretKey, phrase: null }, password)
}

/** Decrypt the vault into {secretKey, phrase}. Throws on bad password. */
export async function decryptVault(
  vault: EncryptedVault, password: string,
): Promise<DecryptedSecrets> {
  const salt = b64ToBytes(vault.salt)
  const iv   = b64ToBytes(vault.iv)
  const ct   = b64ToBytes(vault.ciphertext)
  const key  = await deriveKey(password, salt, vault.iterations)
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct))

  // v1 → ciphertext IS the secret key.
  if (vault.v === 1) {
    return { secretKey: plain, phrase: null }
  }
  // v2 → JSON-encoded payload.
  try {
    const text = new TextDecoder().decode(plain)
    const obj  = JSON.parse(text) as { phrase: string | null; secretKey: number[] }
    return {
      secretKey: Uint8Array.from(obj.secretKey),
      phrase:    obj.phrase ?? null,
    }
  } catch {
    throw new Error('Vault payload is corrupted or unreadable.')
  }
}

/** Legacy alias — returns just the secret key. Prefer `decryptVault`. */
export async function decryptSecret(
  vault: EncryptedVault, password: string,
): Promise<Uint8Array> {
  return (await decryptVault(vault, password)).secretKey
}

/* ── storage ────────────────────────────────────────────────────────────── */

export function saveEncryptedVault(v: EncryptedVault): void {
  localStorage.setItem(VAULT_KEY, JSON.stringify(v))
}

export function loadEncryptedVault(): EncryptedVault | null {
  try {
    const raw = localStorage.getItem(VAULT_KEY)
    return raw ? JSON.parse(raw) as EncryptedVault : null
  } catch { return null }
}

export function hasEncryptedVault(): boolean {
  return localStorage.getItem(VAULT_KEY) !== null
}

export function clearEncryptedVault(): void {
  localStorage.removeItem(VAULT_KEY)
}
