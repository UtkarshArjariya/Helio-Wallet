# Wallet Vault (`@helio/core/wallet`)

The extension-safe wallet primitives that turn a password + mnemonic (or imported key) into a
signing keypair, and back into encrypted bytes at rest. This is the most security-sensitive module
in the workspace.

`Status: ✅ Built` (HD derivation + AES-GCM/PBKDF2 vault are implemented and unit-tested)

---

## What this module provides

- **Mnemonic generation and validation** — BIP39 (12/24 words).
- **Solana account derivation** — hand-rolled **SLIP-0010 ed25519** HD derivation along
  `m/44'/501'/0'/0'` (Phantom-compatible).
- **Private-key import parsing** — base58 secret keys.
- **Password-based vault encryption/decryption** — **AES-256-GCM** with a **PBKDF2-SHA256**
  (310,000 iterations) derived key.
- **Mnemonic / key export after re-authentication** — the password must be re-supplied to unlock
  exportable secrets.

Sensitive byte arrays are zeroed (best-effort) as soon as they are no longer required — see Zeroing below.

---

## How derivation works

The HD derivation is implemented directly rather than delegated to a library, so the exact path and
hardening behavior stay visible and testable:

1. Derive the BIP39 seed from the mnemonic.
2. Master node = `HMAC-SHA512("ed25519 seed", seed)` → `{ privateKey, chainCode }`.
3. For each path segment in `m/44'/501'/0'/0'`, harden the index (`+ 0x80000000`) and run
   `HMAC-SHA512(parentChainCode, 0x00 || privateKey || index)`; the first 32 bytes become the new
   private key, the last 32 the new chain code.
4. The final 32-byte private key seeds a `@solana/web3.js` `Keypair`.

Relevant constants (top of `wallet-vault.ts`):

```ts
const DEFAULT_SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";
const ED25519_SEED_KEY = new TextEncoder().encode("ed25519 seed");
const HARDENED_OFFSET = 0x80000000;
```

> `ed25519-hd-key` is listed as a dependency of `@helio/core` but is **not imported here** — the
> derivation above replaces it. The dependency should be removed.

---

## How the vault works

- **Cipher:** `AES-256-GCM` (random IV per encryption).
- **Key derivation:** `PBKDF2(SHA-256, 310_000 iterations)` over a random salt, producing a 256-bit key.
- **Stored envelope:** records the algorithm (`aes-gcm`), key-derivation (`pbkdf2`), and iteration
  count alongside the ciphertext so future migrations can detect older parameters.

```ts
const PBKDF2_ITERATIONS = 310_000;
const PBKDF2_HASH = "SHA-256";
const PBKDF2_KEY_LENGTH = 256;
```

> The live extension (`src/lib/vault-crypto.ts`) uses ~300,000 iterations; reconcile to one shared constant.

---

## Zeroing (best-effort)

After every operation, this module calls `zeroSensitiveByteArray(...)` on the materials it created —
secret keys, chain codes, derived seeds, the serialized index buffer, salts, IVs, ciphertext, and
decoded imported keys. This is **best-effort**: JavaScript may retain copies the module cannot reach,
and zeroing only covers buffers *this module* owns. It does not constrain how the caller holds the
returned keypair.

---

## Files

| File | Purpose |
|---|---|
| `wallet-vault.ts` | All of the above — derivation, import, encrypt/decrypt, export |
| `wallet-vault.test.ts` | Unit tests (Vitest) |

For the package-level overview and dependency table, see [`../../README.md`](../../README.md).
