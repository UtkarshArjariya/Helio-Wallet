# ADR 0001: Keep Shared Wallet Logic in Packages

- Status: Accepted
- Date: 2026-04-08

## Context

Helio is maintained as a monorepo with a Chrome extension app and shared packages.
The extension client needs wallet domain concepts, RPC orchestration, and transaction
adjustment logic, while platform-specific UI and storage remain in the app layer.

## Decision

- Keep `apps/extension` focused on browser wallet UI, navigation, and extension integrations.
- Move reusable wallet domain types into `packages/types`.
- Keep Solana transaction logic in `packages/solana` and pure key-management logic in `packages/core`.
- Delay shared UI extraction until both apps have overlapping primitives worth reusing.

## Consequences

- Shared package boundaries are defined early, before feature code starts landing.
- Platform apps can stay smaller and easier to review.
- Some duplication in early UI work is acceptable until patterns stabilize.
