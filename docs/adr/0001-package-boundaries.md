# ADR 0001: Keep Shared Wallet Logic in Packages

- Status: Accepted
- Date: 2026-04-08

## Context

Helio is starting as a monorepo with a Chrome extension and a React Native mobile app.
Both clients will need the same wallet domain concepts, RPC orchestration, and transaction
adjustment logic, but platform-specific UI and storage will remain separate.

## Decision

- Keep `apps/extension` and `apps/mobile` focused on platform UI, navigation, and native integrations.
- Move reusable wallet domain types into `packages/types`.
- Keep Solana transaction logic in `packages/solana` and pure key-management logic in `packages/core`.
- Delay shared UI extraction until both apps have overlapping primitives worth reusing.

## Consequences

- Shared package boundaries are defined early, before feature code starts landing.
- Platform apps can stay smaller and easier to review.
- Some duplication in early UI work is acceptable until patterns stabilize.
