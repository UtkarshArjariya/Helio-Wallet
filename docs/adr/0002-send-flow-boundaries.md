# ADR 0002: Keep Send Flow Logic Split by Responsibility

- Status: Accepted
- Date: 2026-04-12

## Decision

- UI screens collect input, show validation state, and render fee or adjustment summaries.
- `@helio/solana` owns transaction building, simulation, and adjustment suggestions.
- `@helio/core` owns signing boundaries and secure wallet access.
- Shared send-flow input and result shapes should live in `@helio/types`.

## Why

The send flow is the highest-risk path in the wallet. Keeping UI, signing, and transaction
analysis separated should make later review and testing easier.

## Current reality (2026-05-30)

The layered intent above is the target. The shipping send path now **partially adopts** it:
it simulates, runs the Smart Adjust review, and zeroes the ephemeral keypair — but still
signs/submits in-page rather than through the `@helio/api` boundary. Recording the state so the
decision is not mistaken for the full implementation:

- The live send is a two-step **Review → Confirm** flow. `reviewSend` (`src/contexts/WalletContext.tsx`)
  builds the exact transaction, runs a **mandatory `simulateTransaction` (fail-closed)**, feeds the
  result to the pure `@helio/solana` engine (`analyzeSmartTransactionReview`) via
  `src/lib/send-review.ts`, and renders a `SmartAdjustReviewModal`. On confirm, `submitSend`
  **signs in-page** via `src/lib/helio-program.ts` against the Anchor program
  (`send_sol` / `sendSolPlain`). It does **not** yet route submission through `@helio/api`.
- **Smart Transaction Adjustment is now wired into the live send.** The review engine in
  `@helio/solana` is real, unit-tested, and called from the shipping UI, which renders an
  adjustment card (original→adjusted amount, fee breakdown, reasons, blocked state) on both the
  vault-sweep and plain-transfer paths. `Status: ✅ Built`.
- **Mandatory pre-send simulation is now enforced on the live path.** `reviewSend` simulates
  before submission; a program error **or** an RPC failure to simulate both block the send.
  `Status: ✅ Built`.
- **Per-signing key zeroing is now partial on the live path.** `zeroKeypairSecret` in
  `src/lib/helio-program.ts` overwrites the ephemeral per-send keypair's `_keypair.secretKey`
  after signing. The durable session secret is retained at rest by design (wallet stays unlocked).
  `Status: ⚠️ Partial`.

There are two parallel app trees: the **shipped** in-page tree (`src/App.tsx`, `src/screens`,
`src/contexts`, `src/lib`) and an **orphaned** popup↔background bridge tree
(`src/app/*`, `src/features/*`, `src/extension-runtime/*`). The mandatory-simulation,
Smart-Adjust-review, and ephemeral-key-zeroing code now lives in the **shipped** tree (wired
directly into `src/contexts` + `src/lib` + `src/screens`, not by consolidating the orphaned
tree); the **dApp approval UI** still lives only in the orphaned tree and is never imported.
**Consolidating these two trees onto the layered send flow remains a tracked priority.**

📱 Mobile app: developed as a separate repo — see `/mobile`.
