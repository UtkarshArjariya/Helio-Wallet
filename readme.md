<h1 align="center">
  <br>
  <img src="https://img.shields.io/badge/☀️-HELIO_WALLET-7C3AED?style=for-the-badge&labelColor=0A0E1A" alt="Helio Wallet" height="60"/>
  <br><br>
  Helio Wallet
  <br>
</h1>

<p align="center">
  <strong>The Solana wallet that thinks before it sends — and earns while you sleep.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Solana-Native-9945FF?style=flat-square&logo=solana&logoColor=white"/>
  <img src="https://img.shields.io/badge/Chrome-Extension_(MV3)-4285F4?style=flat-square&logo=googlechrome&logoColor=white"/>
  <img src="https://img.shields.io/badge/License-MIT-10B981?style=flat-square"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black"/>
  <img src="https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white"/>
  <img src="https://img.shields.io/badge/Turborepo-Monorepo-EF4444?style=flat-square&logo=turborepo&logoColor=white"/>
  <img src="https://img.shields.io/badge/Cluster-Devnet-F59E0B?style=flat-square"/>
</p>

---

<br>

## The Vision

Helio is a **non-custodial Solana wallet** delivered as a **Chrome Extension (Manifest V3)**. It does everything you'd expect from a modern wallet — onboard, send, receive, view balances and charts, browse history — with two ideas at its heart that set it apart:

> **🧠 Smart Transaction Adjustment** — Helio simulates every transaction before you send it, detects potential issues (insufficient rent, missing token accounts, fee miscalculations), and suggests an adjusted amount so your transaction _just works_.

> **📈 AutoYield** — Every time you transact, Helio sweeps a micro-amount into a user-owned, on-chain PDA reserve so idle capital can compound — completely non-custodial.

These two differentiators are the north star. The sections below are explicit about **what ships today** versus what is scaffolded or planned, so you always know what you're running.

> 📱 **Mobile app:** developed as a separate repo — see `/mobile`. This README covers the Chrome extension only.

<br>

---

## Status Legend

Every feature and claim in this README carries an honest status label:

| Token | Meaning |
|---|---|
| ✅ **Built** | Implemented **and** wired into the shipping extension |
| ⚠️ **Partial** | Partly implemented, has real gaps |
| 🟠 **Scaffolded** | Code/UI exists but is **not** wired into the live app (dead/mock), or is a placeholder stub |
| ❌ **Planned** | Not implemented yet |

<br>

---

## Feature Status

| Feature | Status | Notes |
|---|---|---|
| Onboarding — create / import seed phrase / import base58 key | ✅ Built | BIP39 + SLIP-0010 ed25519 HD derivation, Phantom-compatible path `m/44'/501'/0'/0'` |
| Encrypted vault (AES-256-GCM + PBKDF2) + unlock/lock | ✅ Built | Vault at rest is encrypted; see [Security Posture](#security-posture) |
| Dashboard / live balances | ✅ Built | 30s refresh, Jupiter metadata |
| Standard SOL send | ✅ Built | On-chain personal-vault sweep via Anchor `send_sol` / `sendSolPlain` |
| Token detail / OHLCV charts | ✅ Built | Jupiter `datapi.jup.ag` |
| Activity / transaction history | ✅ Built | |
| Recovery-phrase + private-key export | ✅ Built | Re-auth gated |
| Settings (network/currency/language/address-book/launch-mode/auto-lock/theme) | ✅ Built | "Manage apps" + "spending approvals" are empty placeholders |
| Token metadata cache | ✅ Built | Jupiter Tokens v2; see [Token Metadata Cache](#token-metadata-cache) |
| Receive | ✅ Built | Real scannable QR (`qrcode.react`), copy + native share (clipboard fallback), honest network label (`ACTIVE_CLUSTER_LABEL`); **buy/transfer deposit buttons remain non-functional placeholders** |
| AutoYield — on-chain vault | ⚠️ Partial | **Devnet only.** init/pause/resume/config/sweep/withdraw work; `deployed` & `rewards` are always 0; APY is hardcoded |
| Smart Transaction Adjustment | ✅ Built | Wired into the live send: two-step Review → Confirm runs a mandatory `simulateTransaction` (fail-closed), feeds the `@helio/solana` engine via `src/lib/send-review.ts`, and shows a `SmartAdjustReviewModal` (original→adjusted amount, fee breakdown, reasons, blocked state). Covers vault-sweep (`send_sol`) and plain-transfer paths |
| Swap | 🟠 Scaffolded | `SwapScreen` computes output from cached price ratios; **button has no `onClick`**; no real Jupiter quote/execution |
| Staking (native + liquid mSOL/bSOL) | 🟠 Scaffolded | "Coming soon" placeholder |
| Private / Jito bundle send | 🟠 Scaffolded | Hard-disabled until bundle integration ships |
| dApp connect/approval (Wallet Standard) | 🟠 Scaffolded | Backend exists, but the approval UI lives in the orphaned app tree, so background waits 120s for a message the live popup never sends → **every dApp request hangs to timeout** |
| AutoYield — DeFi deploy + Jupiter auto-convert | ❌ Planned | No CPI to Kamino/Meteora/MarginFi; no swap instruction; `SwapQuoteClient` interface has no implementation |
| RPC v2 migration (`@solana/web3.js` v2) | ❌ Planned | Currently on web3.js v1 |
| Rate-limited / scheme-validated RPC wrapper | ⚠️ Partial | `src/lib/rpc-guard.ts` adds a token-bucket limiter (via web3.js `fetchMiddleware`) on the singleton `connection` + `validateRpcUrl` scheme allowlist in `rpc-service.ts`. **Not** yet covering `HelioRpcClient` failover or a few screens' own `Connection`s; see [Security Posture](#security-posture) |
| Blowfish phishing detection | ❌ Planned | Local origin risk stub only; Blowfish is `.env` scaffolding, not integrated |

<br>

---

## Tech Stack

This is the **actual** stack as built (it diverges from the original plan in a few places — noted inline).

| Layer | Choice |
|---|---|
| Monorepo | **pnpm@9 workspaces + Turborepo** |
| UI | **React 19.2 + TypeScript** (strict mode `true` in `tsconfig.base.json`) |
| Build | **Vite 7.x** — MV3 packaged via a static `public/manifest.json` + manual Rollup inputs (background, content-script, injected-provider, popup). _Not CRXJS._ |
| State | **React Context + hooks** _(Zustand was planned but is not installed/used)_ |
| Styling | **Tailwind CSS v3** (+ `tailwindcss-animate`, `tailwind-merge`), PostCSS |
| Routing | Hand-rolled `RouterContext` with **hash-based routing** (so reloads don't 404). _(`wouter` has been removed.)_ |
| Solana SDK | **`@solana/web3.js` ^1.98.4** (v1) + **`@solana/spl-token` ^0.4.14** _(v2 migration is Planned)_ |
| HTTP | **`ky` ^2.x** · Icons: **`lucide-react`** · QR: **`qrcode.react` ^4.2.0** (Receive screen) |
| Lint / format | **Biome 2.x** (single tool) |
| Testing | **Vitest 3.2.4** (unit only). _No Playwright / E2E yet._ |
| CI | **None today** (no `.github/workflows`) — a target, not a current fact |
| Extension manifest version | **0.1.5** |
| Cluster | **Devnet** (default) |

> Helio is also published as a **Vercel SPA** (same hash routing, immutable asset cache) in addition to the Chrome extension package.

<br>

---

## Architecture

The live extension source lives at the **repo root `src/`** — `index.html` → `src/main.tsx` → `src/App.tsx`. (`apps/extension/` holds only a stale `dist` build and should be treated as deprecated; `apps/mobile/` is empty and is moving to a separate repo.)

```
Helio-Wallet/
├── index.html               → src/main.tsx → src/App.tsx   (live extension)
├── public/manifest.json      MV3 manifest (v0.1.5), static
├── src/
│   ├── App.tsx, screens/, contexts/, lib/   ← SHIPPED app tree
│   │   └── lib/helio-program.ts   signs txs in-page vs the Anchor program
│   │   └── lib/idl/               vendored Anchor IDL
│   └── app/, features/, extension-runtime/  ← ORPHANED tree (mock/dead)
├── packages/                 5 workspace packages (below)
├── anchor/                   on-chain "helio" Anchor program
└── /mobile                   separate repo (pointer only)
```

### Workspace packages

| Package | Responsibility |
|---|---|
| **`@helio/core`** | Keys/crypto: BIP39, hand-rolled SLIP-0010 ed25519 HD derivation (path `m/44'/501'/0'/0'`, Phantom-compatible), AES-256-GCM + PBKDF2-SHA256 vault, message signing, password policy, best-effort byte zeroing. _(`ed25519-hd-key` is a declared-but-unused dependency.)_ |
| **`@helio/solana`** | **Pure, RPC-free** smart-transaction review engine + priority-fee estimator + AutoYield state machine. _Known issue: `auto-yield-program.ts` derives PDAs from the SPL token-swap **example** program id (`Fg6Pa…Q7QZ`), not Helio's real deployed program — so it is local simulation only and must be fixed._ |
| **`@helio/api`** | **The runtime / RPC layer.** The ~1,560-line `HelioRpcClient` (build/simulate/submit, dApp transaction review, ordered RPC failover) + Jupiter price/tokens/charts clients + a local origin-based risk provider. **The RPC client lives here** — any older doc that says `@helio/solana` owns RPC is wrong. Failover is sequential try-each; it is **not** rate-limited and custom RPC URLs are **not** scheme-validated (both are Planned hardening items). |
| **`@helio/types`** | Types-only contract leaf (no runtime deps). |
| **`@helio/ui`** | Currently just a single `HELIO_THEME_TOKENS` object (design tokens). No components yet. |

### Two parallel app trees (a tracked priority)

There are two app trees in `src/`, and consolidating them is on the roadmap:

1. **Shipped tree** — `src/App.tsx` + `src/screens` + `src/contexts` + `src/lib`. Signs transactions **in-page** via `src/lib/helio-program.ts` against the Anchor program.
2. **Orphaned tree** — `src/app/*` + `src/features/{dapp-approval,popup-dashboard,wallet-workflow}` + `src/extension-runtime/extension-client.ts`. This is the intended popup↔background message-bridge architecture, currently mock/dead.

> ⚠️ **Mandatory pre-send simulation, Smart Adjust review, and per-signing key zeroing now live in the SHIPPED tree** — they were wired directly into `src/contexts` + `src/lib` + `src/screens` (not by consolidating the orphaned tree). The **dApp approval UI** still lives only in the **dead tree** and is unwired. Consolidating the two trees remains a tracked priority — see [Security Posture](#security-posture).

### On-chain program (`anchor/`)

The Anchor program **"helio"** is **deployed & executable on Devnet** (null on mainnet):

- **Program id:** `Bc5g2hU4NDah3yqvA1zxTeNJkU7zN7NLx7VFhpquNg1u`
- ~1,060 LOC · **11 instructions** · 24 typed errors · PDA-signed CPIs · ~2,100-line test suite.
- Manually scaffolded (anchor/cargo CLI were not installed in the build env). The extension consumes a vendored IDL at `src/lib/idl/`.
- It **sweeps SOL/stablecoin into per-user PDA vaults.** It has **no** instruction that deploys/stakes into Kamino/Meteora/MarginFi (that is Planned). "Protocol selection" is config metadata only. There is **no `close_vault` instruction** yet (a rent-reclaim gap).

```
Live data flow (shipped path):

  src/App.tsx ──▶ src/lib/helio-program.ts ──▶ Anchor program (Bc5g2…) on Devnet
                          │
                          └──▶ @helio/api  ──▶ Solana RPC (ordered failover)
                                            └─▶ Jupiter (prices / tokens / charts)
```

<br>

---

## Development (Chrome Extension)

Helio is a Manifest V3 extension. From the repo root:

1. `pnpm install`
2. `pnpm dev` — starts the Vite dev server (web preview of the popup)
3. `pnpm build` — type-checks (`tsc --noEmit`) and produces the production build in `dist/`
4. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the build output.

Useful scripts:

| Script | What it does |
|---|---|
| `pnpm test` | Vitest unit tests |
| `pnpm lint` | Biome check on `src` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm sync-idl` | Refresh the vendored Anchor IDL from the build artefact |

<br>

---

## Using Helio

> The flows below describe shipping behaviour. Where a feature is **Scaffolded** or **Partial**, that is called out so the docs don't oversell.

### 🏠 Dashboard — ✅ Built

The dashboard is your home base. At the top you'll see your **total portfolio value**, followed by your tokens sorted by value — each showing balance, fiat equivalent, and 24-hour price change. **Send**, **Receive**, **Swap**, and **Stake** action buttons sit below the balance. Prices refresh automatically every 30 seconds.

### 📤 Sending Tokens — ✅ Built (with live Smart Adjustment)

Tap **Send**, pick a token, enter an amount (or **MAX**), enter a recipient, and review. Standard SOL send works today, including the on-chain personal-vault sweep via the Anchor program. The send is now a **two-step Review → Confirm** flow: `reviewSend` builds the exact transaction, runs a **mandatory `simulateTransaction`** (fail-closed), feeds the pure `@helio/solana` engine via `src/lib/send-review.ts`, and surfaces a **Smart Adjust** card before you confirm.

> **Smart Adjustment card — ✅ Built.** The card below now renders in the live send path (`SmartAdjustReviewModal` in `src/screens/SendScreen.tsx`), showing original→adjusted amount, a fee breakdown, plain-language reasons, and a blocked state. It covers both the vault-sweep (`send_sol`) and plain-transfer paths.

```
  ⚡ Smart Adjustment        (now live in the shipping send path)
  ─────────────────────────────
  Original:   5.000 SOL
  Adjusted:   4.991 SOL

  Reason: Reserves 0.009 SOL for:
    • Rent exemption   0.00089 SOL
    • Network fee      0.00005 SOL
    • Priority fee     0.00806 SOL

  [ Accept Adjustment ]  [ Send Original ]
```

### 📥 Receiving Tokens — ✅ Built

Tap **Receive** to see your address in readable 4-character groups; **copy** and **Share** work — the Share button uses `navigator.share` with a clipboard fallback. The **QR code is now a real, scannable code** (`QRCodeSVG` from `qrcode.react`) encoding the address, and the network label is honest (`ACTIVE_CLUSTER_LABEL` → "Devnet"/"Mainnet", no longer hardcoded "Mainnet"). Note: the **"Buy with card"** and **"Transfer from exchange"** deposit buttons remain non-functional placeholders.

### 🔄 Swapping Tokens — 🟠 Scaffolded

The `SwapScreen` computes an estimated output from cached price ratios and shows a route/price-impact preview, but the **swap button has no handler** and there is no real Jupiter quote or execution yet.

### 💰 Staking SOL — 🟠 Scaffolded

The **Stake** tab is a "Coming soon" placeholder. Native and liquid-staking (mSOL/bSOL) flows are planned.

### 📈 AutoYield — ⚠️ Partial (on-chain vault), ❌ Planned (DeFi deploy)

AutoYield is Helio's passive savings layer and a headline differentiator. **What works today (Devnet only):** the on-chain vault supports init / pause / resume / config / sweep / withdraw through the Anchor program, with funds held in a **user-owned PDA** — fully non-custodial.

**What does not work yet:**

- `deployed` and `rewards` values are always **0**, and the displayed **APY is hardcoded**.
- There is **no DeFi deployment** — no CPI into Kamino / Meteora / MarginFi, and no Jupiter auto-convert (the `SwapQuoteClient` interface has no implementation). Treat "protocol selection" as config metadata, not live capital deployment.

```
  📈 AutoYield               (devnet; deployed/rewards values are placeholders)
  ─────────────────────────────
  Total Saved:     $24.81 USDC   (illustrative)
  Current APY:     8.3% (Kamino) (target — hardcoded today)
  Accrued Yield:   $0.00         (rewards always 0 today)

  [ Withdraw ]  [ Settings ]
```

### 🌐 Connecting to dApps (Wallet Standard) — 🟠 Scaffolded

The Wallet-Standard backend (provider-bridge, `background.ts`, extension-service) exists. **However**, the approval UI lives in the orphaned app tree, so the background script waits 120s for an approval message that the live popup never sends — meaning **every dApp request currently hangs to timeout.** Wiring the approval UI into the shipped tree is required before this works.

### ⚙️ Settings — ✅ Built (mostly)

- **Theme** — Dark (default), Light, or system.
- **Network** — switch cluster or enter a custom RPC URL _(note: custom URLs are not scheme-validated yet)_.
- **Security** — change password, set auto-lock timer, export seed phrase / private key (re-auth gated).
- **Address Book**, **Currency**, **Language**, **Launch mode**.
- _"Manage apps" and "spending approvals" are empty placeholders._

<br>

---

## Token Metadata Cache — ✅ Built

Token metadata (name, symbol, decimals, icon URL, verification status, organic-score, tags) is served by **Jupiter Tokens API v2** (`/tokens/v2/search` and `/tokens/v2/tag`) through the same `apiKey` + `baseUrls` + failover plumbing as the Jupiter price feed (`packages/api/src/integrations/jupiter-tokens-client.ts`).

Results are persisted locally for offline-friendly UX:

- **Storage**: `chrome.storage.local` inside the extension; the web build falls back to `localStorage`. Both adapters implement a single `TokenStorageAdapter` contract (see `src/lib/token-metadata-cache.ts`).
- **TTL**: 7 days for verified tokens, 24h for unverified.
- **Cap**: 1000 entries; oldest `cachedAtMs` is evicted first.
- **Icons**: we store only the icon URL, never the bytes. The browser's HTTP cache handles the image data, keeping us well under the 5 MB `chrome.storage.local` quota.
- **Hook**: `useTokenMetadata(mint)` exposes `{ data, loading, error, isStale }` with stale-while-revalidate semantics (synchronous in-memory hit on subsequent renders, background refresh when stale).
- **Settings**: `clearTokenCache()` wipes only token entries; `pruneExpired()` runs on extension startup to keep the cache compact.

<br>

---

## Key Differentiator: Smart Transaction Adjustment

Most wallets let you type an amount and hit send. If something goes wrong — you didn't leave enough for rent, a token account needs creation, fees are higher than expected — you find out _after_ it fails.

**Helio does this.** The Smart Adjust engine (real and unit-tested in `@helio/solana`), now wired into the live send via `src/lib/send-review.ts`:

1. **Simulates** the transaction against current network state (mandatory, fail-closed).
2. **Analyzes** the result for rent-exemption violations, missing accounts, and fee shortfalls.
3. **Proposes** a corrected amount with a transparent breakdown.
4. **Asks** for your confirmation — you're always in control.

> **Status: ✅ Built.** The engine is wired into the live send path (Review → Confirm) and renders an adjustment card (`SmartAdjustReviewModal`) on both the vault-sweep and plain-transfer paths. The goal is a **>99% transaction success rate** — that is a **target**, not a measured result today.

<br>

---

## Key Differentiator: AutoYield

Most wallets let your stablecoins sit idle. Getting into DeFi yield requires manual steps, protocol research, and an understanding of liquidity mechanics — friction that stops most people from ever starting.

**Helio's vision removes that friction.** On every transaction, a configurable micro-amount sweeps into a **user-owned PDA reserve**; once it crosses a threshold, capital is deployed into whitelisted Solana yield protocols — all non-custodial, withdrawable any time.

- **On-chain reserve (PDA sweep / withdraw): ⚠️ Partial** — works on **Devnet** today.
- **Jupiter auto-convert + DeFi deployment (Kamino / Meteora / MarginFi): ❌ Planned** — not yet implemented.

> Headline figures such as **8.3% APY (Kamino)** are **targets** for the deployed product, not current returns. Today's APY is hardcoded and on-chain `rewards` are 0.

<br>

---

## Security Posture

Helio's project rules (`CLAUDE.md`) set strict security mandates. Here is an honest reconciliation of mandate vs. reality:

| Mandate | Status | Reality |
|---|---|---|
| Vault encryption at rest (AES-256-GCM + PBKDF2) | ✅ Confirmed | Live `vault-crypto.ts` ~300k iters; package `wallet-vault.ts` ~310k iters (iteration count to be reconciled) |
| `chrome.storage.session` for the session secret; encrypted vault in `localStorage` | ⚠️ Partial | Also mirrors the raw secret to `sessionStorage` as a JSON `number[]`, which defeats later zeroing |
| Per-signing key zeroing | ⚠️ Partial | `zeroKeypairSecret` in `src/lib/helio-program.ts` overwrites the ephemeral per-send keypair's `_keypair.secretKey` after signing. The durable session secret in `chrome.storage.session`/`sessionStorage` is retained by design (wallet stays unlocked), so at-rest exposure is unchanged |
| Rate-limited + validated RPC wrapper; no direct `Connection` from UI | ⚠️ Partial | `src/lib/rpc-guard.ts` adds a token-bucket limiter on the singleton `connection` (web3.js `fetchMiddleware`) + `validateRpcUrl` scheme allowlist (https / loopback-http) in `rpc-service.ts`. **Not** yet covering `HelioRpcClient` failover (still not rate-limited) or a few screens' own `Connection`s (e.g. NetworkSettings latency probes) |
| Mandatory `simulateTransaction` before every send | ✅ Enforced | The live send runs `simulateTransaction` before submit, fail-closed — a program error **or** an RPC failure to simulate both block the send |
| Domain-based phishing detection (Blowfish) | ❌ Stub only | An HTTPS-vs-HTTP + localhost check via `local-risk-provider.ts`; Blowfish is `.env` scaffolding, not integrated |

> **Bottom line:** the wallet is non-custodial and the vault is encrypted at rest. **Mandatory pre-send simulation is now enforced** in the shipping path, and **per-signing key zeroing** and a **rate-limited + scheme-validated RPC wrapper** are now **partial** (the ephemeral per-send keypair is zeroed; the singleton `connection` is rate-limited and RPC URLs are scheme-validated). Gaps that remain: the durable session secret is still retained at rest, `HelioRpcClient` failover is not yet rate-limited, and real phishing detection (Blowfish) is still a stub. Closing the rest — largely by consolidating the orphaned tree into the shipped tree — is the top priority.

<br>

---

## License

MIT.

<br>

---

<p align="center">
  <img src="https://img.shields.io/badge/Built_with-☀️_Helio-7C3AED?style=for-the-badge&labelColor=0A0E1A"/>
  <br><br>
  <strong>Helio Wallet</strong> — Smart sends. Passive yield. Solana native.
  <br>
  <sub>Non-custodial · MIT · Solana Native · Devnet</sub>
</p>
