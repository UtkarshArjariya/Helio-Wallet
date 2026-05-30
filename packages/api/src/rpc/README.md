# RPC Client — `@helio/api/rpc`

This module is the extension-facing Solana access layer. The `HelioRpcClient` **lives here** — not in `@helio/solana` (which is the pure, RPC-free review/fee/AutoYield engine). UI code should not call `@solana/web3.js` directly.

> 📱 Mobile app: developed as a separate repo — see `/mobile`.

`createHelioRpcClient(networkPreference, options)` resolves an endpoint pool, wraps it with ordered failover, and exposes the `HelioRpcClient` interface:

- **`getWalletDashboardSnapshot(...)`** — SOL + SPL balances and USD valuation (via the optional Jupiter price feed).
- **`getNetworkStatus()`** — endpoint / cluster health.
- **`reviewSendTransfer(...)`** — builds an unsigned native-SOL or SPL transfer and runs it through the `@helio/solana` review engine → `SendReviewModel`.
- **`reviewDappTransaction(...)`** — decodes a base64 dApp transaction, summarizes instructions, and attaches a risk assessment from the configured `DappRiskProvider` (defaults to the local origin-based provider).
- **`submitSendTransfer(...)`** — signs, **simulates** (mandatory in this path), submits, confirms, and zeroes the keypair secret after signing.

Also exported: `resolveRpcEndpoint` / `resolveRpcEndpointPool`.

## Failover, not yet hardened

Failover is **sequential try-each** via `executeWithOrderedFailover` (`../failover/ordered-failover.ts`): primary → fallback, first success wins. It is **not** rate-limited. Two hardening items are `Status: ❌ Planned`:

- **No rate limiter** — there is no throttling/back-off anywhere.
- **No custom-RPC scheme validation** — `resolveRpcEndpointPool` accepts a user-supplied `customRpcUrl` verbatim, with no `https:`-only allowlist.

The CLAUDE.md mandate of a *"rate-limited, validated RPC wrapper"* is a **target**, not yet met.

## Wiring status

`Status: 🟠 Scaffolded` for the live wiring. The package code is built and unit-tested, but the **shipping** extension (`src/App.tsx` tree) signs in-page via `src/lib/helio-program.ts` and goes straight to `.rpc()` — it does **not** route through this client. The build → mandatory simulate → submit flow and per-signing key zeroing here are the **intended target architecture**. Consolidating the live and orphaned trees is a tracked priority.

See [`../../README.md`](../../README.md) for the full package overview.
