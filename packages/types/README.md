# @helio/types

> Shared TypeScript contracts for **Helio Wallet** — a non-custodial Solana Chrome extension (Manifest V3).

`@helio/types` is the **types-only contract leaf** of the workspace. It holds the interfaces and
type aliases that every other package agrees on, and it has **no runtime dependencies** — nothing
here ships executable code. Importing it costs nothing at runtime; the build emits only `.d.ts`.

`Status: ✅ Built`

> 📱 Mobile app: developed as a separate repo — see `/mobile`.

---

## What lives here

Each domain gets its own file, all re-exported from `src/index.ts`:

| File | Contracts |
|---|---|
| `wallet.types.ts` | Wallet session state, vault envelope, keypair/account shapes |
| `network.types.ts` | Network/cluster preferences (the app defaults to **devnet**) |
| `onboarding.types.ts` | Seed-phrase verification challenge/submission, import inputs |
| `send-flow.types.ts` | Send-flow inputs/outputs, smart-transaction review, fee breakdown, urgency tiers |
| `portfolio.types.ts` | Balances, token/asset summaries, OHLCV/chart shapes |
| `auto-yield.types.ts` | AutoYield settings, state, status, sweep/deploy previews |
| `dapp.types.ts` | dApp connection/approval request shapes (Wallet Standard) |
| `extension.types.ts` | Extension runtime / message-bridge contracts |

---

## Why a types-only package

- **Single source of truth.** `@helio/core`, `@helio/solana`, `@helio/api`, and the live extension
  all import the *same* interfaces, so a change to a contract is a compile error everywhere it
  matters — not a silent drift.
- **Zero runtime cost.** No dependencies (the `dependencies` field in `package.json` is empty), no
  side effects. The package compiles to declaration files only.
- **Clean dependency direction.** Everything depends on `@helio/types`; `@helio/types` depends on
  nothing. It is a true leaf.

---

## Consumers

| Package | Uses these types for |
|---|---|
| `@helio/core` | Seed-phrase verification, wallet/vault shapes |
| `@helio/solana` | Smart-transaction review, priority fee, AutoYield state |
| `@helio/api` | RPC client request/response shapes, dApp review, portfolio data |
| live extension (`src/`) | Screen props, context state, message-bridge payloads |

---

## Scripts

```bash
pnpm --filter @helio/types build      # tsc build to dist/ (.d.ts only)
pnpm --filter @helio/types test       # vitest (passWithNoTests — types-only)
pnpm --filter @helio/types typecheck  # tsc --noEmit (strict mode)
pnpm --filter @helio/types lint       # biome check
```

> Conventions: TypeScript **strict mode** is on workspace-wide. Keep this package runtime-free —
> if something needs executable code, it belongs in `@helio/core`, `@helio/solana`, or `@helio/api`,
> not here.
