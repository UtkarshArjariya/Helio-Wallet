import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@helio/api": resolve(__dirname, "../packages/api/src/index.ts"),
      "@helio/core": resolve(__dirname, "../packages/core/src/index.ts"),
      "@helio/solana": resolve(
        __dirname,
        "../packages/solana/src/index.ts",
      ),
      "@helio/types": resolve(__dirname, "../packages/types/src/index.ts"),
      "@helio/ui": resolve(__dirname, "../packages/ui/src/index.ts"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "index.html"),
        background: resolve(
          __dirname,
          "src/extension-runtime/background.ts",
        ),
        "content-script": resolve(
          __dirname,
          "src/provider-bridge/provider-content-script.ts",
        ),
        "injected-provider": resolve(
          __dirname,
          "src/provider-bridge/provider-injected.ts",
        ),
      },
      output: {
        entryFileNames: (chunkInfo) =>
          ["background", "content-script", "injected-provider"].includes(
            chunkInfo.name,
          )
            ? "[name].js"
            : "assets/[name]-[hash].js",
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
