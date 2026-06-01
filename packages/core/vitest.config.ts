import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// A local config so `@helio/core` tests do NOT inherit the root app's
// `vite.config.ts` test block (whose `setupFiles: ["./vitest.setup.ts"]`
// resolves to a non-existent file from this package and breaks collection).
// Mirrors `packages/solana/vitest.config.ts` and `packages/api/vitest.config.ts`.
export default defineConfig({
  resolve: {
    alias: {
      '@helio/types': resolve(__dirname, '../types/src/index.ts'),
    },
  },
});
