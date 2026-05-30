import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// A local config so `@helio/solana` tests do NOT inherit the root app's
// `vite.config.ts` test block (whose `setupFiles: ["./vitest.setup.ts"]`
// resolves to a non-existent file from this package and breaks collection).
// Mirrors `packages/api/vitest.config.ts`; only `@helio/types` is referenced
// (type-only) by the existing smart-transaction test.
export default defineConfig({
  resolve: {
    alias: {
      "@helio/types": resolve(__dirname, "../types/src/index.ts"),
    },
  },
});
