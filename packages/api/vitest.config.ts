import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@helio/solana": resolve(__dirname, "../solana/src/index.ts"),
      "@helio/types": resolve(__dirname, "../types/src/index.ts"),
    },
  },
});
