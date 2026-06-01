# @helio/solana

> Pure, **RPC-free** Solana logic for **Helio Wallet** — a non-custodial Solana Chrome extension (Manifest V3).

This package is the deterministic brain behind Helio's two headline differentiators —
**Smart Transaction Adjustment** and **AutoYield** — *the Solana wallet that thinks before it
sends, and earns while you sleep.* It contains **no network calls**: every function here is a pure
transform over inputs the caller supplies. RPC, simulation, and submission live in `@helio/api`, not
here.

> ⚠️ **Architecture note:** earlier docs claimed `@helio/solana` owns the RPC client. That is wrong.
> The `HelioRpcClient` (build / simulate / submit / failover) lives in **`@helio/api`**. This package
> is intentionally RPC-free so its logic stays unit-testable in isolation.

> 📱 Mobile app: developed as a separate repo — see `/mobile`.

---

## Responsibilities (canonical)

| Module | What it does | Status |
|---|---|---|
| **Smart-transaction review engine** (`smart-transaction/smart-transaction-review.ts`) | Pure analysis of a proposed send: amount quotes, fee breakdown, USD equivalents, and `SmartAdjustmentReason` flags. Produces a `SmartTransactionReview`. | `🟠 Scaffolded` — engine is real and unit-tested, but the live send path never calls it (it goes straight to `.rpc()`); no adjustment card in the shipping UI. |
| **Priority-fee estimator** (`smart-transaction/priority-fee.ts`) | `estimatePriorityFeeLamports(samples, urgency)` — percentile pick (low 0.35 / medium 0.6 / high 0.85) over caller-supplied recent-fee samples. | `🟠 Scaffolded` — works and is tested; not wired into the live send. |
| **AutoYield state machine** (`auto-yield/auto-yield-state.ts`) | Pure config/preview logic: round-up unit, percentage bps, deploy threshold, sweep & deploy previews, status transitions. | `⚠️ Partial` — drives the on-chain vault (devnet); deployed/rewards are always 0 and APY is hardcoded upstream. |
| **AutoYield PDA derivation** (`auto-yield/auto-yield-program.ts`) | Derives the config / reserve / authority / SOL-vault / stable-vault PDAs for the AutoYield program. | `✅` — derives from the real deployed program id (`EJw2Y8…`). |

---

## AutoYield program id

`auto-yield/auto-yield-program.ts` derives all of its PDAs from Helio's real deployed program id:

```ts
export const HELIO_AUTO_YIELD_PROGRAM_ID =
  "EJw2Y8jJwbw1CeHRDRHSeUYzU2L1ke1aqmkQLod5T151";
```

The PDAs derived here match the on-chain `helio` program's accounts. (The earlier `Fg6Pa…` SPL
token-swap example id has been replaced — that mismatch is resolved.)

> The live extension signs against the Anchor program via the vendored IDL at `src/lib/idl`
> through `src/lib/helio-program.ts` and the `@solana/kit` client.

---

## Public API surface

Everything is re-exported from `src/index.ts`:

```
src/
├── auto-yield/
│   ├── auto-yield-program.ts   // PDA derivation (⚠️ wrong program id — see above)
│   └── auto-yield-state.ts     // config + sweep/deploy previews + status transitions
├── errors/helio-solana-error.ts // typed HelioSolanaError + error codes
└── smart-transaction/
    ├── priority-fee.ts          // percentile-based priority-fee estimate
    └── smart-transaction-review.ts // pure send-review engine
```

---

## Design principles

- **RPC-free.** No `Connection`, no fetch, no `web3.js` network call. Callers pass in fee samples,
  prices, and account summaries; functions return plain data. This keeps the engine deterministic
  and 100% unit-testable.
- **Atomic-amount math.** Amounts are handled as whole-number atomic strings / `bigint` to avoid
  floating-point drift; USD equivalents are computed only for display.
- **Typed errors.** Failures throw `HelioSolanaError` with a stable code (e.g. `INVALID_AMOUNT`,
  `INSUFFICIENT_PRIORITY_FEE_DATA`).

---

## Dependencies

| Package | Used for |
|---|---|
| `@helio/types` (workspace) | Shared type contracts (no runtime code) |
| `@solana/web3.js` `^1.98.4` | `PublicKey` / `findProgramAddressSync` for PDA derivation (web3.js **v1**, not v2) |

> A web3.js **v2** migration is a future/Planned item; this package is on v1 today.

---

## Scripts

```bash
pnpm --filter @helio/solana build      # tsc build to dist/
pnpm --filter @helio/solana test       # vitest (unit only)
pnpm --filter @helio/solana typecheck  # tsc --noEmit (strict mode)
pnpm --filter @helio/solana lint       # biome check
```

Tested with **Vitest** (unit only — no E2E). Covered modules include `priority-fee` and
`smart-transaction-review`.
