# @helio/ui

Shared design-system package for [Helio Wallet](../../README.md) — the non-custodial Solana Chrome extension (Manifest V3).

> 📱 Mobile app: developed as a separate repo — see `/mobile`. These docs are **extension-only**.

## What's in here today

Right now this package exports exactly one thing: **`HELIO_THEME_TOKENS`** — a single design-tokens object (`src/theme/helio-theme.ts`) describing Helio's colors, corner radii, and typography, plus its `HelioThemeTokens` type.

```ts
import { HELIO_THEME_TOKENS } from "@helio/ui";
```

- **colors** — backgrounds/surfaces, text, borders, accents (`accentPrimary` `#6D28D9`, `accentSecondary` `#4CD7F6`), and `success` / `warning` / `danger`.
- **radii** — `card`, `button`, `sheet`.
- **typography** — `display` (Manrope), `body` (Inter), `mono` (Space Grotesk).

`Status: ✅ Built` — for the tokens object itself.

## No shared components yet

`Status: ❌ Planned` — this package currently has **no React components**. The shipping extension's UI lives at the repo root under `src/` (React 19.2 + TypeScript, Tailwind CSS v3, hand-rolled hash-based `RouterContext`), and components are defined there, not in `@helio/ui`. Extracting reusable components into this package is a planned step; today its only job is to be the single source of truth for design tokens.

## Tech stack

- **Language:** TypeScript (strict mode, `tsconfig.base.json`).
- **No runtime deps** — pure tokens; `package.json` declares no dependencies.
- **Build/lint/test:** `tsc` build, Biome 2.x lint/format, Vitest 3.2.4 (unit only — passes with no tests today).

```bash
pnpm --filter @helio/ui build      # tsc -> dist/
pnpm --filter @helio/ui typecheck
pnpm --filter @helio/ui lint
pnpm --filter @helio/ui test
```

## Layout

```
packages/ui/src
├── index.ts                # export * from "./theme/helio-theme"
└── theme/
    └── helio-theme.ts      # HELIO_THEME_TOKENS + HelioThemeTokens type
```

## License

MIT — part of the Helio Wallet monorepo (pnpm@9 workspaces + Turborepo).
