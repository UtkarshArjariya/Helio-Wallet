// Codama codegen — generates the typed `@solana/kit` (web3.js v2) client for the
// Helio AutoYield Anchor program from the vendored IDL (ADR-0005 / ADR-0004 Phase 3).
//
// Single source of truth: `src/lib/idl/helio.json` (the same IDL the legacy Anchor
// client at `src/lib/helio-program.ts` loads). The IDL is the modern Anchor 0.30+
// format (top-level `address`, per-instruction `discriminator`, embedded `pda.seeds`),
// which `@codama/nodes-from-anchor` ingests directly.
//
// Output (`packages/solana/src/generated/helio/`) is COMMITTED and reviewable, and is
// excluded from Biome (generated code follows the renderer's own style). Regenerate with:
//   pnpm --filter @helio/solana generate:client
// A re-run must produce a no-op git diff (reproducibility gate).

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import renderJavaScriptVisitor from "@codama/renderers-js";
import { createFromRoot } from "codama";

const here = dirname(fileURLToPath(import.meta.url));
const packageFolder = resolve(here, "..");
const idlPath = resolve(packageFolder, "../../src/lib/idl/helio.json");
// Path under `packageFolder` the renderer writes (and wipes) — keeps the emitted
// tree flat at `packages/solana/src/generated/helio/*`.
const generatedFolder = "src/generated/helio";

const idl = JSON.parse(readFileSync(idlPath, "utf8"));

const codama = createFromRoot(rootNodeFromAnchor(idl));

await codama.accept(
  renderJavaScriptVisitor(packageFolder, {
    generatedFolder,
    // Reproducibility: wipe ONLY `generatedFolder` each run. The parity test lives
    // at `src/generated/helio-client.parity.test.ts` (a SIBLING of `helio/`), so it
    // is never clobbered.
    deleteFolderBeforeRendering: true,
    // Prettier-format the emitted code for readable diffs (Biome ignores this tree).
    formatCode: true,
    // Do not let the renderer mutate `packages/solana/package.json` deps.
    syncPackageJson: false,
  }),
);

console.log(
  `Generated Helio Kit client → ${resolve(packageFolder, generatedFolder)}`,
);
