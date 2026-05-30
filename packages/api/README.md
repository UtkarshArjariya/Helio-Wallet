# @helio/api

The **runtime / network layer** of [Helio Wallet](../../README.md) — the non-custodial Solana Chrome extension (Manifest V3) that aims to be *"the Solana wallet that thinks before it sends, and earns while you sleep."*

This package owns everything that touches the network: the Solana RPC client (build / simulate / submit + dApp transaction review + ordered RPC failover), the Jupiter price / tokens / charts clients, and a local origin-based dApp risk provider. It depends only on the pure leaves `@helio/solana` and `@helio/types`.

> 📱 Mobile app: developed as a separate repo — see `/mobile`. This package and these docs are **extension-only**.

> **Where RPC lives.** The Solana RPC client lives **here**, in `@helio/api` — not in `@helio/solana`. `@helio/solana` is the *pure, RPC-free* review/fee/AutoYield engine. Any architecture note that says otherwise is stale.

---

## What's in here

| Subdir | Module | Purpose | Status |
|---|---|---|---|
| `rpc/` | `helio-rpc-client.ts` (~1,560 LOC) | `HelioRpcClient` — dashboard snapshot, network status, send-transfer build/simulate/submit, dApp transaction review, ordered RPC failover | `Status: ✅ Built` (the package itself) — but see wiring note below |
| `integrations/` | `jupiter-price-feed-client.ts` | Jupiter Price v3 — USD prices for portfolio valuation | `Status: ✅ Built` |
| `integrations/` | `jupiter-tokens-client.ts` | Jupiter Tokens v2 — metadata lookup + free-text search + verified-tag list | `Status: ✅ Built` |
| `integrations/` | `jupiter-charts-client.ts` | Jupiter OHLCV candles from `datapi.jup.ag` for token charts | `Status: ✅ Built` |
| `integrations/` | `local-risk-provider.ts` | Local, origin-based dApp risk assessment (HTTPS / localhost heuristics) | `Status: ⚠️ Partial` (stub-grade; see Security) |
| `integrations/` | `integration-contracts.ts` | Shared TypeScript interfaces for the integration clients above | `Status: ✅ Built` |
| `failover/` | `ordered-failover.ts` | `executeWithOrderedFailover` — sequential try-each-candidate helper | `Status: ⚠️ Partial` (no rate limiting; see Hardening) |

### Status legend

- `Status: ✅ Built` — implemented AND wired into the shipping extension
- `Status: ⚠️ Partial` — partly implemented, has real gaps
- `Status: 🟠 Scaffolded` — code exists but is NOT wired into the live app, or is a placeholder stub
- `Status: ❌ Planned` — not implemented yet

---

## `HelioRpcClient` — `rpc/`

`createHelioRpcClient(networkPreference, options)` returns the high-level client the extension backend uses instead of calling `@solana/web3.js` directly. See [`src/rpc/README.md`](./src/rpc/README.md) for the detailed surface.

Public methods (`HelioRpcClient` interface):

- **`getWalletDashboardSnapshot(account, activity, autoYieldState)`** — SOL + SPL balances, USD valuation via the price feed, holdings rows.
- **`getNetworkStatus()`** — endpoint + cluster health.
- **`reviewSendTransfer(input)`** — builds an unsigned native-SOL or SPL transfer and runs it through the `@helio/solana` review engine, returning a `SendReviewModel` (including the Smart Transaction Adjustment suggestion).
- **`reviewDappTransaction(input)`** — decodes a base64 transaction from a dApp, summarizes the instructions, and attaches a risk assessment.
- **`submitSendTransfer(input)`** — signs, **simulates** (mandatory in this path), submits, and confirms; zeroes the keypair secret after signing via `zeroSensitiveByteArray`.

Endpoint resolution helpers are also exported: `resolveRpcEndpoint` and `resolveRpcEndpointPool`.

> **Important — `@helio/api` is not on the live send path yet.** The shipping extension (the `src/App.tsx` tree) signs transactions **in-page** via `src/lib/helio-program.ts` against the Anchor program, and the live send goes straight to `.rpc()`. The compliant build → **mandatory simulate** → submit flow, per-signing key zeroing, and the dApp approval path described here all live in `@helio/api` and the orphaned `src/extension-runtime/*` tree — they are the *intended target architecture*, not the current live path. Consolidating the two trees is a tracked priority. `Status: 🟠 Scaffolded` for the wiring; the package code itself is built and unit-tested.

### Ordered RPC failover — `failover/`

`executeWithOrderedFailover(candidates, operation)` runs `operation` against each candidate (primary → fallback) and returns the first success, throwing the last error if all fail. `withRpcFailover` in the RPC client wraps this over the resolved transport pool.

It is intentionally simple: **sequential try-each**. Two hardening items are **not** implemented:

- **Rate limiting** — `Status: ❌ Planned`. There is no rate limiter anywhere; the failover does not throttle or back off.
- **Custom RPC URL scheme validation** — `Status: ❌ Planned`. `resolveRpcEndpointPool` accepts a user-supplied `customRpcUrl` verbatim with **no scheme allowlist** (e.g. no `https:`-only check).

These reconcile against the project's CLAUDE.md mandate of a *"rate-limited, validated RPC wrapper"* — that mandate is a **target**, not yet met.

---

## Jupiter integrations — `integrations/`

All three clients use `ky` for HTTP and share the ordered-failover pattern over base URLs.

| Client | Endpoint | Notes |
|---|---|---|
| `createJupiterPriceFeedClient` | `price/v3` on `api.jup.ag` | USD prices + 24h change for portfolio/holdings valuation |
| `createJupiterTokensClient` | `tokens/v2/search`, `tokens/v2/tag` | Metadata + free-text search + verified-tag list; batch limit `JUPITER_TOKENS_BATCH_LIMIT = 100`; throws `TokenNotFoundError` |
| `createJupiterChartsClient` | `datapi.jup.ag` (OHLCV) | Separate origin from `api.jup.ag`; the chart history host is unofficial relative to the documented price/swap host |

The extension layers a **token-metadata cache** on top of the tokens client (Jupiter Tokens v2; 7-day verified / 24h unverified TTL; 1000-entry eviction) — `Status: ✅ Built`.

> Note: `SwapQuoteClient` and `ValidatorDirectoryClient` interfaces are declared in `integration-contracts.ts` but have **no implementation** — Swap and Staking are scaffolded/planned. `Status: 🟠 Scaffolded` / `Status: ❌ Planned`.

---

## Local risk provider — `integrations/local-risk-provider.ts`

`createLocalDappRiskProvider()` is the built-in `DappRiskProvider` used when no external security vendor is configured. It produces a `DappRiskAssessment` (`trustLevel` + `warnings`) for connection / message / transaction requests, based purely on the request **origin**:

- HTTPS origin → `unknown` (or `verified` for `localhost` / `127.0.0.1`).
- Non-HTTPS, non-local origin → `flagged` with a critical `insecure-origin` warning.

This is **not** real phishing detection. `Status: ⚠️ Partial` — Blowfish (or equivalent) domain-based phishing detection is `.env` scaffolding only and **not integrated**. `Status: ❌ Planned`.

---

## Tech stack

- **Language:** TypeScript (strict mode, `tsconfig.base.json`).
- **Solana SDK:** `@solana/web3.js` ^1.98.4 (**v1**, not v2) + `@solana/spl-token` ^0.4.14. A v2 migration is a future/Planned item.
- **HTTP:** `ky` ^2.x.
- **Workspace deps:** `@helio/solana` (pure review/fee/AutoYield engine), `@helio/types` (types-only contract leaf).
- **Build/lint/test:** `tsc` build, Biome 2.x for lint/format, Vitest 3.2.4 for **unit tests only** (no Playwright / no E2E).
- **Cluster:** the extension currently defaults to **Devnet**.

```bash
pnpm --filter @helio/api build      # tsc -> dist/
pnpm --filter @helio/api typecheck
pnpm --filter @helio/api lint        # biome check src
pnpm --filter @helio/api test        # vitest run (unit)
```

---

## Layout

```
packages/api/src
├── index.ts                    # public exports
├── rpc/
│   ├── helio-rpc-client.ts     # HelioRpcClient (build/simulate/submit + dApp review + failover)
│   └── README.md
├── integrations/
│   ├── integration-contracts.ts
│   ├── jupiter-price-feed-client.ts
│   ├── jupiter-tokens-client.ts
│   ├── jupiter-charts-client.ts
│   └── local-risk-provider.ts
└── failover/
    └── ordered-failover.ts     # executeWithOrderedFailover (sequential, NOT rate-limited)
```

---

## License

MIT — part of the Helio Wallet monorepo (pnpm@9 workspaces + Turborepo).
