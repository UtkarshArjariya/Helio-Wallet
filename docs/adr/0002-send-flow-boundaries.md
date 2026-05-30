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

The layered intent above is still the target, but the **shipping send path bypasses this
layering**. Recording the gap so the decision is not mistaken for the implementation:

- The live send **signs in-page** via `src/lib/helio-program.ts`, building and submitting the
  transaction directly against the Anchor program (`send_sol` / `sendSolPlain`) and calling
  `.rpc()`. It does **not** route signing through a `@helio/core` boundary or build through
  `@helio/api` in the live flow.
- **Smart Transaction Adjustment is not wired into the live send.** The review engine in
  `@helio/solana` is real and unit-tested, but the shipping UI never calls it and renders no
  adjustment card. `Status: 🟠 Scaffolded`.
- **Mandatory pre-send simulation is not in the live path.** `simulateTransaction` exists only
  in the unused `@helio/api` `submitSendTransfer`; the in-page path goes straight to submit.
  `Status: ❌ Planned`.
- **Per-signing key zeroing is not in the live path.** `src/lib/helio-program.ts` holds the raw
  secret without `.fill(0)`; compliant zeroing lives only in the orphaned message-bridge tree.

There are two parallel app trees: the **shipped** in-page tree (`src/App.tsx`, `src/screens`,
`src/contexts`, `src/lib`) and an **orphaned** popup↔background bridge tree
(`src/app/*`, `src/features/*`, `src/extension-runtime/*`) that holds the compliant
simulation, signing-boundary, and adjustment code but is never imported. **Consolidating
these two trees onto the layered send flow is a tracked priority.**

📱 Mobile app: developed as a separate repo — see `/mobile`.
