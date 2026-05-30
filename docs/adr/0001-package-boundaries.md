# ADR 0001: Keep Shared Wallet Logic in Packages

- Status: Accepted
- Date: 2026-04-08

## Context

Helio is maintained as a monorepo with a Chrome extension app and shared packages.
The extension client needs wallet domain concepts, RPC orchestration, and transaction
adjustment logic, while platform-specific UI and storage remain in the app layer.

## Decision

- Keep `extension` focused on browser wallet UI, navigation, and extension integrations.
- Move reusable wallet domain types into `packages/types`.
- Keep Solana transaction logic in `packages/solana` and pure key-management logic in `packages/core`.
- Delay shared UI extraction until the extension and shared package needs overlap more.

## Consequences

- Shared package boundaries are defined early, before feature code starts landing.
- The platform app stays smaller and easier to review.
- Some duplication in early UI work is acceptable until patterns stabilize.

## Current reality (2026-05-30)

The accepted decision still holds, but the live layout has drifted from the original
`apps/extension` framing. Recording the current shape so the boundaries stay honest:

- **Live extension source lives at the repo root `src/`**, not `apps/extension/`.
  Entry is `index.html` → `src/main.tsx` → `src/App.tsx`. `apps/extension/` now holds
  only a stale `dist` build and should be treated as deprecated; `apps/mobile/` is empty.
- **`@helio/types`** remains the types-only contract leaf — accurate to the decision.
- **`@helio/core`** owns keys/crypto (BIP39, SLIP-0010 ed25519 HD derivation, AES-256-GCM
  + PBKDF2 vault, message signing) — accurate to the decision.
- **`@helio/solana`** is the **pure, RPC-free** smart-transaction review engine, priority-fee
  estimator, and AutoYield state machine. It does **not** own RPC.
- **`@helio/api` owns RPC.** The runtime `HelioRpcClient` (build/simulate/submit, dApp
  transaction review, ordered RPC failover) and the Jupiter price/tokens/charts clients live
  here, alongside a local origin-based risk provider. Any earlier wording implying
  `@helio/solana` owns RPC is superseded by this note.
- **`@helio/ui` currently contains design tokens only** (`HELIO_THEME_TOKENS`) — **no
  components yet**. This matches the decision to delay shared UI extraction; the package
  exists as a tokens leaf until UI patterns stabilize.

📱 Mobile app: developed as a separate repo — see `/mobile`.
