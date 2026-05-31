# ADR-0005: Codama `@solana/kit` client + cutover of the Anchor vault signing path

- **Status:** Accepted; Stages 0–4 landed 2026-05-31 — the shipped vault path (all 8
  signing instructions + the send + the account read) is fully off Anchor and on Kit;
  `@coral-xyz/anchor` is now a devDep-only (test oracle). **Devnet smoke test pending**
  (the one thing byte-parity + fail-closed simulation cannot prove — on-chain acceptance).
- **Relates:** [[0004-kit-migration]] (this is the "separate ADR" Phase-4 of 0004 pointed to).

## Context

ADR-0004 migrated Helio's read leaf and PDA derivation to `@solana/kit` (web3.js v2)
but left the **signing path on web3.js v1**, because `@coral-xyz/anchor 0.32` (the
hand-written client in `src/lib/helio-program.ts`) is hard-locked to v1. The unblock
named there: **generate a Codama Kit client from the IDL** (`src/lib/idl/helio.json`)
and retire the Anchor TS client.

The IDL is modern Anchor 0.30+ (top-level `address`, per-instruction `discriminator`,
embedded `pda.seeds`), so `@codama/nodes-from-anchor` ingests it directly. The app
calls 8 of the program's 11 instructions: `initialize_auto_yield`, `pause_auto_yield`,
`resume_auto_yield`, `update_auto_yield_config`, `send_sol`, `sweep_sol`,
`withdraw_vault_sol`, `withdraw_sol`.

## Decision

Generate a **committed, reproducible** Codama `@solana/kit` client, prove it produces
**byte-for-byte identical instructions** to the Anchor client, then cut the shipped
vault signing path over to it. Staged, each stage gated on green typecheck+test+build.

### Key decisions

1. **Placement: `packages/solana/src/generated/helio/`.** The generated client is pure
   (encoders/decoders/PDA finders; runtime-imports only `@solana/kit` +
   `@solana/program-client-core`). It fits `@helio/solana`'s pure-leaf charter and is
   co-located with the Phase-2 Kit PDA derivation. It introduces **no** edge toward
   `@helio/api` (which depends on `@helio/solana` — the reverse would be circular).
   Exposed namespaced as `helioClient` from `@helio/solana` to avoid colliding with the
   package's flat surface.
2. **Toolchain & reproducibility.** `codama` + `@codama/nodes-from-anchor` +
   `@codama/renderers-js` (+ `@coral-xyz/anchor` as a **test-only** parity oracle) are
   devDependencies of `@helio/solana`. `packages/solana/scripts/generate-helio-client.mjs`
   reads the vendored IDL and renders into `src/generated/helio/`; `pnpm --filter
   @helio/solana generate:client` regenerates and MUST yield a no-op diff. The renderer
   (`renderers-js` 2.2.0) targets Kit 6.9.0 and factors runtime helpers into
   `@solana/program-client-core` (added as a runtime dep of `@helio/solana`). The
   generated tree is excluded from Biome (`biome.json` → `!**/src/generated/helio/**`).
   **Verify the Codama API against installed `.d.ts` before regenerating** — it moves fast.
3. **Parity guarantee (the safety net).** `packages/solana/src/generated/helio-client.parity.test.ts`
   (a sibling of the generated tree, so regeneration never clobbers it) asserts, for
   every instruction the app calls, that the Kit builder's `programAddress` + account
   metas (order/signer/writable) + `data` bytes match Anchor's
   `.accountsStrict().instruction()` output byte-for-byte; that all 11 discriminators
   match the IDL (and the `transaction-history.ts` goldens); that the account codecs
   round-trip; and that the generated PDA finders equal `findAutoYieldProgramAddresses`.
4. **Hardened Kit RPC write surface.** `packages/api/src/rpc/kit-rpc.ts` gains
   `simulateTransactionBase64` / `sendTransactionBase64` / `getSignatureStatus` on the
   SAME rate-limited + URL-validated transport. These are **key-free** (they transmit
   caller-built wire transactions), so the leaf stays custody-free. Simulation uses
   `replaceRecentBlockhash: true` (mutually exclusive with `sigVerify`, which stays off).
   Confirmation is `getSignatureStatus` polling — the MV3-safe primitive (subscriptions
   need a `wss://` endpoint MV3 service workers idle-suspend).
5. **Cutover scope.** IN: the 8 Anchor vault instructions + the plain-SOL transfer and
   ComputeBudget priority fee entangled in `submitSend` + `fetchOnChainVaultState` reads.
   OUT (stay on v1): native staking (`StakeProgram`) and Jupiter swap (v0
   `VersionedTransaction`) — neither is Anchor; their shared v1 helpers remain.
6. **Security mandates preserved** (CLAUDE.md §5): fail-closed simulation before every
   send (a program error OR an RPC failure both block); per-signing key zeroing — the
   64-byte secret is imported via `createKeyPairSignerFromBytes` into a **non-extractable**
   WebCrypto Ed25519 key (a strict improvement over v1's `_keypair.secretKey.fill(0)`),
   and the input byte copy is zeroed after; all Kit RPC through the hardened transport.

## Status of work

- [x] **Stage 0 — generate + byte-parity-validate (DONE, verified).** Client generated
      into `packages/solana/src/generated/helio/`; reproducible (no-op regen diff);
      Biome-excluded; namespaced re-export. Parity suite proves all 8 live instructions
      byte-identical to Anchor + 11 discriminators + PDA-finder parity + codec round-trip
      (22 tests). `@helio/solana` 42 tests, `@helio/api` 38→44, root 55 — all
      typecheck+test+build green.
- [x] **Stage 1a — hardened Kit RPC write surface (DONE, verified).** `kit-rpc.ts`
      `simulateTransactionBase64`/`sendTransactionBase64`/`getSignatureStatus` on the
      rate-limited transport; 6 unit tests incl. fail-closed-on-RPC-failure and the
      Kit `err`-payload bigint-upcast quirk.
- [x] **Stage 1b — Kit signing pipeline (DONE, verified).**
      `packages/api/src/rpc/helio-kit-signer.ts` — a key-free pipeline (build →
      fail-closed simulate of the UNSIGNED tx → priority-fee CU sizing + re-simulate →
      sign with a non-extractable WebCrypto signer → send → MV3 `getSignatureStatus`
      poll-confirm → zero the secret copy), composing the generated builders +
      `@solana-program/{system,compute-budget}` + the Kit RPC writer. Lives in
      `@helio/api` (no app-tree coupling — takes secret bytes + args). 13 unit tests vs a
      mock RPC: fail-closed on program-error AND RPC-failure, priority-fee two-pass,
      key-zeroing (incl. on failure), poll-confirm + on-chain-error + timeout.
- [x] **Stage 2 — reroute the 7 one-shot vault instructions (DONE).** `WalletContext`
      `initialize/pause/resume/updateConfig/addFunds(sweepSol)/withdraw` now call
      `kitSigner`; the v1 secret flows via a new `requireSecret()` (a copy `kitSigner`
      zeros). `fetchOnChainVaultState` reads stay on v1 (Anchor read — not one of the 8
      instructions; migrating it is follow-up cleanup).
- [x] **Stage 3 — reroute the send path (DONE).** `submitSend` → `kitSigner.sendSol`/
      `sendSolPlain` (sweep → generated `getSendSolInstruction`; plain →
      `@solana-program/system`; priority fee → `@solana-program/compute-budget`; the
      two-pass simulate + CU-sizing lives inside the pipeline). `send-review.ts`
      `reviewNativeSolSend` → `kitSigner.simulateSend` (noop-signer, build+simulate, no
      sign/send). Root typecheck + 55 tests + build green.
- [x] **Stage 4 — retire Anchor from the shipped path (DONE).** Deleted the dead v1
      signing functions from `src/lib/helio-program.ts` (the 8 `.rpc()` signers,
      `sendSolPlain`, `buildSendSol*`, `computeBudgetInstructions`,
      `assembleTransaction`, `signSendAndConfirm`, `KeypairWallet`, `ReadOnlyWallet`,
      `makeProgram`, `DEFAULT_INIT_ARGS`) — the file shrank 733 → 417 lines. Migrated
      the **read** (`fetchOnChainVaultState`) off Anchor to the Codama-generated account
      decoders over the hardened Kit RPC (`getAccountInfo` base64 →
      `getBase64Encoder()` → `getUserAutoYieldConfigDecoder()`/`getUserReserveStateDecoder()`),
      same `OnChainVaultState` shape. `helio-program.ts` no longer imports
      `@coral-xyz/anchor`; shipped `src/` has **zero** Anchor imports. `@coral-xyz/anchor`
      moved to **devDependencies** (root + `@helio/solana`) — kept only as the
      byte-parity test oracle + for the separate `anchor/` program workspace. Root gained
      `@solana/kit` as a direct dep (`helio-program.ts`'s `getBase64Encoder`). The v1
      helpers staking/swap still use (`simulateSendTransaction`, `signSendAndConfirmWith`,
      `zeroKeypairSecret`) are retained by design. Full matrix green
      (`@helio/solana` 42 · `@helio/api` 57 · root 55, all typecheck+test+build).

## Verification & the devnet caveat

In-repo nets: **byte-for-byte instruction parity** (Stage 0) proves the encoding is
correct; **fail-closed simulation** gates every send. These are necessary but not
sufficient: whether the *deployed* program accepts the Kit-built transactions can only
be confirmed on **devnet with a funded wallet**. Until the smoke test runs — initialize
vault → add funds (sweep_sol) → send-with-sweep (send_sol) → plain send → withdraw →
pause/resume → update config — the cutover (Stages 2–4) is "byte-parity-proven +
simulation-gated, pending devnet verification," and should be labeled as such.

## Consequences

- **+** Restores full static typing (removes the `as any` `Program` erosion at cutover);
  one PDA-derivation source of truth; security improves (non-extractable WebCrypto key).
- **+** Foundation (Stages 0–1a) is fully in-repo-verified with zero custody exposure.
- **−** Larger committed surface (generated code) — offset by reviewability + Biome
  exclusion. Anchor stays installed (as a test-only oracle) until the cutover completes.
- **−** The live cutover touches the shipped signing path; it must be devnet-verified
  before it can be trusted in production.
