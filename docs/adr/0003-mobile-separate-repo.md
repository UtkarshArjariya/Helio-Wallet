# ADR 0003: Develop the Mobile App in a Separate Repository

- Status: Accepted
- Date: 2026-05-30

## Context

Helio Wallet ships today as a non-custodial Solana Chrome extension (Manifest V3). A mobile
client is planned, and the original monorepo carried an `apps/mobile/` slot for it. That slot
never materialized — `apps/mobile/` is empty (`node_modules` only) — while the extension grew
its own root-level toolchain (Vite 7, a static `public/manifest.json`, manual Rollup inputs,
hash-based SPA routing). The build, packaging, deploy targets, and platform concerns of a React
Native mobile app diverge sharply from a Manifest V3 extension, and keeping both in one workspace
pulls unrelated tooling, dependency trees, and release cadences into a single repo.

The valuable thing to share between the two clients is not the build pipeline or UI — it is the
**domain logic**: key management, the pure transaction-review engine, the type contracts, and a
platform-neutral RPC layer. Those packages have no inherent dependency on the browser or on React
Native.

## Decision

- **Develop the mobile app in its own repository.** A documentation skeleton already lives at
  `/mobile` (`mobile/docs/adr/`) to seed that repo's decision records.
- **Do not revive `apps/mobile/`** in the extension monorepo; treat it as deprecated alongside the
  stale `apps/extension/` dist.
- **Share domain logic via a shared-core strategy with platform adapters.** The packages intended
  to be consumed by both clients are:
  - `@helio/core` — keys/crypto (BIP39, SLIP-0010 ed25519 HD derivation, AES-256-GCM + PBKDF2
    vault, message signing). Platform-neutral.
  - `@helio/solana` — pure, RPC-free smart-transaction review engine, priority-fee estimator, and
    AutoYield state machine. Platform-neutral.
  - `@helio/types` — types-only contract leaf.
  - `@helio/api` — the runtime layer (the `HelioRpcClient` build/simulate/submit + ordered RPC
    failover, plus Jupiter clients). Platform-neutral at the protocol level; platform-specific
    concerns (storage, secure keystore, network transport, biometrics) are supplied through
    **platform adapters** rather than baked into the shared core.
- Cross-reference the mobile repo's own decision record:
  `mobile/docs/adr/0001-shared-core-strategy.md`.

## Consequences

- The extension repo stays extension-only: its tooling, manifest, and Vercel SPA deploy are not
  entangled with React Native's build and native-module concerns.
- The shared packages must stay free of browser-only and extension-only assumptions so they can be
  consumed by the mobile repo. Anything platform-specific is pushed to an adapter boundary.
- A sharing mechanism between two repos (published package versions or a git/workspace link) must
  be established; the cost of that coordination is accepted in exchange for clean separation.
- These ADRs (`docs/adr/*`) and the extension docs remain **extension-only**; mobile-specific
  decisions live in `mobile/docs/adr/`.

📱 Mobile app: developed as a separate repo — see `/mobile` and
`mobile/docs/adr/0001-shared-core-strategy.md`.
