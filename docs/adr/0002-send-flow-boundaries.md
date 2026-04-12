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

