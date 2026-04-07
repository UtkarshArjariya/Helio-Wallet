# Claude — Project Rules & Directives

## Project: Helio Wallet

---

## 1. Working Directory

- **Always work inside the current project directory.** Never create, modify, or reference files outside the project root unless explicitly instructed.
- Use relative paths for all imports, references, and scripts.
- Keep the directory structure clean — no orphaned files, no duplicate configs.

---

## 2. Multi-Agent Approach

- When tasks are complex (e.g., "build the send-token flow end-to-end"), **decompose into sub-agents**:
  - **Architect Agent** — designs the module structure, interfaces, and data flow before any code is written.
  - **Implementation Agent** — writes the actual code following the architect's blueprint.
  - **Review Agent** — audits the implementation for correctness, security, edge cases, and style.
  - **Test Agent** — writes and runs unit/integration tests, reports failures back to the Implementation Agent.
- Each agent's output must be explicit and documented in code comments or PR descriptions.
- Never skip the Review Agent step for any security-sensitive code (key management, transaction signing, RPC calls).

---

## 3. Tech Stack Selection Philosophy

Choose the **best-in-class** stack for each platform. Do not force a single framework across incompatible targets.

### Chrome Extension

| Layer | Choice | Rationale |
|---|---|---|
| UI Framework | **React 18 + TypeScript** | Dominant ecosystem, strong typing, huge talent pool |
| State Management | **Zustand** | Lightweight, no boilerplate, perfect for extension popup size constraints |
| Styling | **Tailwind CSS** | Utility-first, tiny bundle with purge, consistent design tokens |
| Build Tool | **Vite + CRXJS** | Fast HMR, first-class Chrome Extension manifest v3 support |
| Solana SDK | **@solana/web3.js v2 + @solana/spl-token** | Official, maintained, tree-shakeable v2 |
| Wallet Standard | **@solana/wallet-standard** | Interoperability with dApps via the Wallet Standard |
| Testing | **Vitest + Playwright** | Fast unit tests + E2E browser testing |
| Linting | **Biome** | Single tool for lint + format, faster than ESLint + Prettier |

### Mobile App

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **React Native 0.76+ (New Architecture)** | Shared React mental model, native performance with Fabric/TurboModules |
| Navigation | **React Navigation v7** | De facto standard for RN |
| State | **Zustand** | Same store logic portable from extension |
| Styling | **NativeWind v4** | Tailwind for RN — same design tokens as extension |
| Crypto | **@solana/web3.js v2 + react-native-get-random-values** | Polyfill crypto for RN environment |
| Secure Storage | **react-native-keychain** | Biometric-backed keystore for seed phrases |
| Testing | **Jest + Detox** | Unit + E2E for native |

---

## 4. Code Quality Rules

1. **TypeScript strict mode** — `"strict": true` in every `tsconfig.json`. No `any` unless wrapped in a branded utility type.
2. **No implicit returns** in functions that produce side effects.
3. **All exported functions** must have JSDoc with `@param`, `@returns`, and `@throws`.
4. **Error boundaries** around every screen/route component.
5. **No raw `console.log`** in production code — use a structured logger with levels.
6. **Secrets** (RPC endpoints, API keys) go in `.env` files, never committed.

---

## 5. Security-First Development

- **Seed phrases and private keys** must never exist in plaintext in memory longer than the signing operation. Zero the buffer immediately after.
- All RPC calls go through a **rate-limited, validated wrapper** — never call `Connection` methods directly from UI code.
- Transaction simulation (`simulateTransaction`) is **mandatory** before every `sendTransaction`.
- Implement **domain-based phishing detection** for dApp connection requests.
- Chrome Extension: use `chrome.storage.session` (ephemeral) for sensitive session data, never `chrome.storage.local` for keys.

---

## 6. Git & Workflow

- **Conventional Commits** — `feat:`, `fix:`, `chore:`, `security:`, `docs:`.
- Branch naming: `feat/send-token-flow`, `fix/priority-fee-calc`, `security/key-zeroing`.
- Every PR must pass CI (lint + type-check + tests) before merge.
- No force-pushes to `main` or `develop`.

---

## 7. Performance Budgets

| Metric | Chrome Extension | Mobile |
|---|---|---|
| Popup open → interactive | < 300ms | — |
| App cold start | — | < 1.5s |
| Bundle size (popup) | < 500 KB gzipped | — |
| JS bundle (mobile) | — | < 2 MB |
| Transaction submit → confirmation UI | < 800ms (after RPC) | < 800ms |

---

## 8. Documentation

- Every new module gets a `README.md` in its directory.
- Architecture Decision Records (ADRs) live in `docs/adr/`.
- API boundaries between layers are documented with TypeScript interfaces in a shared `types/` package.
