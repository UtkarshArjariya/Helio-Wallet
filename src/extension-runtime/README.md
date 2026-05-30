# Extension Runtime — `src/extension-runtime/`

This module is the **popup ↔ background message-bridge runtime** for Helio Wallet — the non-custodial Solana Chrome extension (Manifest V3). It is the extension backend surface the popup is *meant* to talk to instead of touching RPC or storage directly:

- encrypted vault persistence (`extension-storage.ts`)
- session-only unlocked key material
- popup-to-background request handling (`extension-client.ts`, `extension-service.ts`, `background.ts`)
- a local dev fallback when `chrome.runtime` is unavailable (`local-extension-client.ts`, `mock-rpc-client.ts`)

> 📱 Mobile app: developed as a separate repo — see `/mobile`.

## ⚠️ Status: 🟠 Scaffolded — this is the orphaned / target-architecture tree

Be honest: **this runtime is not what the live extension uses today.** Helio currently has two parallel app trees:

1. **Shipped tree** — `src/App.tsx` + `src/screens` + `src/contexts` + `src/lib`. It signs transactions **in-page** via `src/lib/helio-program.ts` against the Anchor program.
2. **Orphaned / never-imported tree** — `src/app/*`, `src/features/{dapp-approval,popup-dashboard,wallet-workflow}`, and **this directory** (`src/extension-runtime/extension-client.ts` et al.). This is the *intended* popup↔background message-bridge architecture, but it is currently **mock / dead** — nothing in the shipping tree imports it.

So the message bridge, `mock-rpc-client.ts`, and the dApp-approval wiring here describe the **target** architecture, not the current live path. Consolidating the two trees onto this runtime is a tracked priority.

### Why this matters (two known consequences)

- **The compliant security code lives here, in the dead tree.** Per-signing key zeroing, mandatory `simulateTransaction` before send, and the dApp approval UI are implemented in this orphaned tree — **not** in the live `src/lib/helio-program.ts` path. So in the shipping build those mandates are currently unmet. `Status: 🟠 Scaffolded`.
- **dApp connect/approval hangs.** The Wallet-Standard backend (`background.ts`, `extension-service.ts`, provider-bridge) exists, but the approval UI it waits on lives in this orphaned tree. `background.ts` waits ~120s for an approval message the **live** popup never sends → every dApp request hangs to timeout. The approval UI must be wired into the shipping popup. `Status: 🟠 Scaffolded`.

## Intended contract

When this runtime is wired in, the popup should only talk to this module, never directly to RPC or storage. It is meant to sit in front of `@helio/api`'s `HelioRpcClient` (build → **mandatory simulate** → submit, dApp transaction review, ordered RPC failover) and the encrypted vault from `@helio/core`.

## Files

| File | Role |
|---|---|
| `background.ts` | MV3 service worker; Wallet-Standard request routing; waits on approval messages |
| `extension-service.ts` | Core backend service (vault, signing, RPC orchestration) |
| `extension-client.ts` | Popup-side client that talks to the background over `chrome.runtime` |
| `local-extension-client.ts` | Dev fallback client when `chrome.runtime` is unavailable |
| `mock-rpc-client.ts` | Mock RPC used by the dev/dead path |
| `extension-storage.ts` | Encrypted-vault persistence + session key material |
| `provider-config.ts` / `runtime-dependencies.ts` | Wiring config and dependency assembly |

See the repo [`README.md`](../../README.md) for the full architecture picture.
