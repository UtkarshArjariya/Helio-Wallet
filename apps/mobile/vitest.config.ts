import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const ROOT_DIR = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(ROOT_DIR, "src"),
      "@helio/solana": resolve(ROOT_DIR, "../../packages/solana/src/index.ts"),
      "@helio/types": resolve(ROOT_DIR, "../../packages/types/src/index.ts"),
      "@helio/ui": resolve(ROOT_DIR, "../../packages/ui/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
