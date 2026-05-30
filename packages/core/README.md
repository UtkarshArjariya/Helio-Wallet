# @helio/core

> Key management & cryptography for **Helio Wallet** — a non-custodial Solana Chrome extension (Manifest V3).

`@helio/core` is the security-critical leaf of the workspace. It owns everything that touches
private key material: seed-phrase generation/validation, hierarchical-deterministic (HD) key
derivation, the encrypted vault, message signing, the password policy, and best-effort byte
zeroing. It has **no RPC and no UI** — it is pure crypto + types, designed to be auditable in
isolation.

> 📱 Mobile app: developed as a separate repo — see `/mobile`.

---

## Responsibilities (canonical)

| Area | What it does | Status |
|---|---|---|
| **Seed phrases** | BIP39 mnemonic generation (12/24 words), normalization, and validation; onboarding verification challenges (`createSeedPhraseVerificationChallenge`) | `✅ Built` |
| **HD derivation** | Hand-rolled **SLIP-0010 ed25519** derivation along `m/44'/501'/0'/0'` (Phantom-compatible), built directly on HMAC-SHA512 (`ed25519 seed` key) | `✅ Built` |
| **Encrypted vault** | **AES-256-GCM** at-rest encryption with a **PBKDF2-SHA256** (310,000 iterations) key derivation — `encryptVault` / `decryptVault` | `✅ Built` |
| **Key import** | Base58 private-key import parsing and mnemonic import | `✅ Built` |
| **Message signing** | Detached ed25519 signing of arbitrary messages (`security/sign-message.ts`) | `✅ Built` |
| **Password policy** | Strength rules enforced before a vault can be created | `✅ Built` |
| **Byte zeroing** | Best-effort `zeroSensitiveByteArray` over secret keys, chain codes, derived seeds, IVs, and salts after use | `⚠️ Partial` — best-effort only (see Security notes) |

---

## Public API surface

Everything is re-exported from `src/index.ts`:

```
src/
├── encoding/hex.ts               // hex encode/decode helpers
├── errors/helio-core-error.ts    // typed HelioCoreError + error codes
├── security/
│   ├── password-policy.ts        // password strength rules
│   ├── seed-phrase.ts            // BIP39 generation/validation + verification challenge
│   ├── sign-message.ts           // detached ed25519 message signing
│   └── zero-sensitive-bytes.ts   // best-effort buffer zeroing
└── wallet/
    └── wallet-vault.ts           // HD derivation + AES-GCM/PBKDF2 vault (see wallet/README.md)
```

See [`src/wallet/README.md`](./src/wallet/README.md) for the vault internals.

---

## Cryptography details

- **Mnemonic:** BIP39 via `@scure/bip39`. Accepts 12- or 24-word phrases; words are
  trimmed and lower-cased on normalization.
- **Derivation:** SLIP-0010 for the ed25519 curve. The master node is `HMAC-SHA512("ed25519 seed", seed)`;
  each child node hardens the index and re-runs HMAC-SHA512 over the parent chain code. The default
  Solana path is `m/44'/501'/0'/0'`. This is implemented by hand (no library does the per-step
  derivation here) so the exact path and hardening behavior are visible and testable.
- **Vault:** `AES-256-GCM`. The encryption key is derived from the user's password with
  `PBKDF2(SHA-256, 310_000 iterations)` over a random salt; a random IV is generated per encryption.
  Constants live at the top of `wallet/wallet-vault.ts` (`PBKDF2_ITERATIONS = 310_000`,
  `PBKDF2_HASH = "SHA-256"`, `AES-GCM` with a 256-bit key).
- **Signing:** detached ed25519 signatures over caller-supplied bytes.

> **Iteration-count note:** the live extension's `src/lib/vault-crypto.ts` uses ~300,000 PBKDF2
> iterations while this package uses **310,000**. The two should be reconciled to a single shared
> constant.

---

## Dependencies

| Package | Used for |
|---|---|
| `@helio/types` (workspace) | Shared type contracts (no runtime code) |
| `@scure/bip39` | BIP39 mnemonic generation/validation |
| `@solana/web3.js` `^1.98.4` | `Keypair` / public-key utilities (web3.js **v1**, not v2) |
| `bs58` | Base58 encode/decode for key import/export |
| `ed25519-hd-key` | **Declared but unused.** HD derivation is hand-rolled in `wallet-vault.ts`; this dependency should be removed. |

---

## Security notes (honest posture)

- **Best-effort zeroing only.** `zeroSensitiveByteArray` overwrites secret keys, chain codes,
  derived seeds, salts, and IVs immediately after use *within this package*. It cannot zero copies
  the JS engine may have made, and it does **not** govern how callers hold key material. In the
  live extension, the raw 64-byte secret is currently held long-lived in memory by
  `src/lib/helio-program.ts` (no per-signing zeroing on the shipped path) — bringing the live
  signing path up to this package's standard is a tracked priority.
- **No network access.** This package never opens a connection or reads/writes storage; persistence
  and RPC live elsewhere (the live extension stores the encrypted vault in `localStorage` and the
  session secret via `chrome.storage.session`; runtime RPC lives in `@helio/api`).

---

## Scripts

```bash
pnpm --filter @helio/core build      # tsc build to dist/
pnpm --filter @helio/core test       # vitest (unit only)
pnpm --filter @helio/core typecheck  # tsc --noEmit (strict mode)
pnpm --filter @helio/core lint       # biome check
```

Tested with **Vitest** (unit only — no E2E). Covered modules include `seed-phrase`,
`password-policy`, `zero-sensitive-bytes`, `encoding/hex`, and `wallet-vault`.
