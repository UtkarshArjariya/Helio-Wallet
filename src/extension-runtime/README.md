# Extension Runtime — `src/extension-runtime/`

This module is the **MV3 background-worker runtime** for Helio Wallet — the non-custodial Solana Chrome extension (Manifest V3). It is the extension backend surface that runs in the service worker:

- the MV3 service worker entry (`background.ts`) — launch-mode handling + Wallet-Standard request routing
- dApp connect/sign handled in the background worker from the session secret (`dapp-handler.ts`)
- the core backend service (`extension-service.ts`)
- encrypted-vault + session storage (`extension-storage.ts`)
- wiring config + dependency assembly (`provider-config.ts`, `runtime-dependencies.ts`)

> 📱 Mobile app: developed as a separate repo — see `/mobile`.

## Status

`background.ts` is the **live** MV3 service worker (the `background` build input → `background.js` → the manifest `service_worker`). It wires up `extension-service.ts` and `dapp-handler.ts`.

The earlier mock popup↔background message-bridge — `src/app/*`, `src/features/*`, and the popup-side `extension-client.ts` / `local-extension-client.ts` that used to live in this directory — has been **removed**; `src/App.tsx` is now the single app tree. The shipped tree owns the compliant security code: per-signing key zeroing, mandatory `simulateTransaction` before send, and the Smart Adjust review live in `src/contexts` + `src/lib` + `src/screens`.

### dApp round-trip — 🟠 in progress

The Wallet-Standard backend (`background.ts`, `dapp-handler.ts`, provider-bridge) and the approval surface (`src/components/dapp/DappApprovalOverlay.tsx`) exist, and signing runs in the background worker from the session secret (zeroed in a `finally`). The full round-trip is still being unified — the legacy `extension-service` connect/sign path signs from its own wallet state, which the shipped onboarding doesn't populate, so it waits (now bounded to ~60s rather than hanging). Browser E2E is required to confirm the end-to-end flow.

## Intended contract

The background worker sits in front of `@helio/api`'s `HelioRpcClient` (build → **mandatory simulate** → submit, dApp transaction review, ordered RPC failover) and the encrypted vault from `@helio/core`.

## Files

| File | Role |
|---|---|
| `background.ts` | **Live** MV3 service worker; launch-mode + Wallet-Standard request routing |
| `dapp-handler.ts` | **Live** dApp connect/sign in the background worker (signs from the session secret, zeros it in `finally`) |
| `extension-service.ts` | Backend service (vault, signing, RPC orchestration) used by `background.ts` |
| `extension-storage.ts` | Encrypted-vault persistence + session key material |
| `provider-config.ts` / `runtime-dependencies.ts` | Wiring config and dependency assembly |
| `mock-rpc-client.ts` | Mock RPC client — test support for `extension-service.test.ts` |

See the repo [`README.md`](../../README.md) for the full architecture picture.
