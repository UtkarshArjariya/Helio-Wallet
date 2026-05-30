# ADR-0004: web3.js v1 → v2 (`@solana/kit`) migration strategy

- **Status:** Accepted (migration started 2026-05-30)
- **Supersedes/relates:** [[0001-package-boundaries]], [[0002-send-flow-boundaries]]

## Context

Helio is built entirely on `@solana/web3.js` **v1.98.4** (`Connection`, `Keypair`,
`PublicKey`, `Transaction`/`VersionedTransaction`). web3.js **v2** (published as
`@solana/kit`) is a complete, tree-shakeable rewrite with a different API surface
(`createSolanaRpc`, `Address`, `KeyPairSigner`, functional transaction builders).
We want to begin migrating, but a wholesale rewrite is high-risk and, more
importantly, **partially blocked**.

### The decisive blocker: Anchor

`@coral-xyz/anchor 0.32` is **hard-locked to web3.js v1** — `AnchorProvider`,
`new Program(IDL)`, the `KeypairWallet` adapter, and `.methods…rpc()` all consume
v1 `Connection`/`Keypair`/`Transaction`. **Everything in `src/lib/helio-program.ts`**
(the vault sweep, `send_sol`, native staking, the shipped send/sign path) therefore
**cannot** move to Kit until the Anchor TypeScript client is replaced. The realistic
unblock is **not** "upgrade Anchor" but **generating a Codama Kit client from the
IDL** (`src/lib/idl/helio.json`) — tracked as future work, not part of this ADR.

## Decision

**Incremental, dual-install migration. v1 and v2 coexist; migrate read-only leaves
first; keep all signing/Anchor paths on v1 until a Codama Kit client exists.**

1. **Dual-install** `@solana/web3.js` (keep) **and** `@solana/kit` (+ `@solana/compat`,
   `@solana-program/system`, `@solana-program/compute-budget`, `@solana-program/token`).
   Centralize every `fromLegacy*` / `toLegacy*` conversion in a single
   `packages/api/src/compat-boundary.ts` so the seam is auditable.

2. **First leaf = the pure RPC *read* path** in `@helio/api` `HelioRpcClient`
   (`getBalance`, `getParsedTokenAccountsByOwner`, `getLatestBlockhash`,
   `getAccountInfo`). Chosen because it has **zero Anchor coupling, zero signing,
   zero key material** — no custody/security exposure — and it is exactly the code
   CLAUDE.md §5 wants behind one guarded wrapper.
   - `createHelioKitRpc(endpoint)` wraps `createSolanaRpcFromTransport(hardenedTransport)`
     (not `createSolanaRpc(url)`, which would bypass the hardened transport); reads
     use the `.send()` shape, e.g. `await rpc.getBalance(address(owner)).send()` → `{ value }`.
   - **Lamports are `bigint` in Kit** — convert `Number(x)/1e9` only at the UI boundary.
   - Keep the `@helio/types` contract identical so screens don't change.

3. **Land two open security mandates inside the new Kit transport** (turning two
   `❌ TODO`s into `✅`): wrap `createSolanaRpc` with a custom `RpcTransport` that
   enforces the token-bucket limiter from `src/lib/rpc-guard.ts` and validates the
   URL scheme (`validateRpcUrl`). This is the v2 analogue of the `fetchMiddleware`
   already wired into the v1 singleton connection.

4. **Defer**: any signing path, and everything that touches Anchor. If a *send*
   is ever Kit-migrated, note that Kit `simulateTransaction` needs a base64 wire tx
   (`getBase64EncodedWireTransaction`), and `sigVerify`/`replaceRecentBlockhash` are
   mutually exclusive — preserve fail-closed simulation.

### MV3 caveat

Kit's `sendAndConfirmTransactionFactory` needs `rpcSubscriptions` (a `wss://`
endpoint), but MV3 service workers idle-suspend WebSockets. In the extension,
prefer a `getSignatureStatuses` poll-confirm over the subscription-based confirm.
(Irrelevant to the read leaf; decided here so it isn't rediscovered later.)

## Consequences

- **+** Unblocks the v2 path with the lowest-risk slice and pays down two security
  TODOs as a side effect; no custody exposure.
- **+** v1 and v2 coexist safely; nothing in the shipped signing path changes.
- **−** Two SDKs installed during the (long) transition — larger `node_modules`,
  and a `compat-boundary` seam to maintain.
- **−** Full removal of `@solana/web3.js` is gated on **both** all read/swap paths
  being on Kit **and** `helio-program.ts` being off Anchor's v1 client (Codama).
  That is a multi-phase effort; this ADR only commits to Phase 1 (the read leaf).

## Status of work

- [x] Strategy decided + recorded (this ADR).
- [x] Phase 0: dual-install deps (`@solana/kit` + `@solana/compat` +
      `@solana-program/{system,compute-budget,token}`, all `^6.9.0`/latest, in
      `@helio/api`; web3.js v1 + Anchor kept) + `packages/api/src/compat-boundary.ts`
      (`toKitAddress` / `toLegacyPublicKey` / `lamportsToNumber`).
- [x] Phase 1: migrated the `HelioRpcClient` read leaf to Kit
      (`packages/api/src/rpc/kit-rpc.ts` — `getBalance`, `getLatestBlockhash`,
      `getAccountInfo`, `getParsedTokenAccountsByOwner` via
      `createSolanaRpcFromTransport`). Wired into the pure-read methods
      (`getWalletDashboardSnapshot`, `getNetworkStatus`); the `@helio/types`
      contract is unchanged, so no screen changed. The rate-limit + URL-scheme
      mandates now live inside the Kit transport
      (`packages/api/src/rpc/kit-transport.ts`, fail-closed). Vitest covers the
      reader + transport against a mocked transport (17 tests).
      **Note:** the v1 build/sign paths (`reviewSendTransfer`,
      `reviewDappTransaction`, `submitSendTransfer`) still read
      `getLatestBlockhash`/`getAccountInfo` over the **v1** `Connection` — those
      reads feed v1 transaction construction/simulation/signing and move with
      that code (not part of the read leaf).
- [x] Phase 2: migrated the pure, RPC-free PDA derivation in
      `@helio/solana` (`packages/solana/src/auto-yield/auto-yield-program.ts`,
      `findAutoYieldProgramAddresses`) from v1 `PublicKey.findProgramAddressSync`
      to Kit `getProgramDerivedAddress` (`address()` + `getAddressEncoder()`).
      Zero RPC, zero signing, zero key material. `@solana/web3.js` is dropped
      from `@helio/solana`'s **runtime** deps (moved to `devDependencies` for the
      parity test); the package now runs `@solana/kit` only. Two decisions worth
      recording:
  - **The function is now `async`.** Kit derives PDAs with WebCrypto SHA-256,
    which is asynchronous — there is **no** synchronous Kit equivalent of v1's
    `…Sync`. `findAutoYieldProgramAddresses` therefore returns a `Promise`. This
    is a public-API signature change but **non-breaking**: it has zero in-repo
    consumers (verified by grep across `src/` + `packages/`); future callers must
    `await` it. (So the Phase-2 line item's old "`address()` only" framing was
    optimistic — pure PDA derivation cannot stay synchronous under Kit.)
  - **`@helio/solana` does NOT reuse `compat-boundary.ts`.** `@helio/api` already
    depends on `@helio/solana`, so importing the boundary from `@helio/api` would
    create a **circular** dependency. It also needs no local conversion helper at
    all: this leaf has no v1↔v2 seam — inputs are base58 strings and Kit
    `Address` is itself a branded base58 string, returned directly as the
    unchanged `string` contract. The `@solana/compat` `fromLegacy*`/`toLegacy*`
    seam stays scoped to `@helio/api`, where v1 `PublicKey`s actually cross over.
  - **Parity is byte-for-byte and tested.** `auto-yield-program.test.ts`
    reproduces the old v1 derivation in-process and asserts identical output
    across fixed real-world vectors, 100 generated keypairs, and a raw-byte
    comparison (plus determinism / mint-vs-owner seed sensitivity / invalid-input
    tests). It is additionally anchored to **frozen golden PDAs** derived from the
    verified on-chain seed constants (`config`/`reserve`/`authority`/`sol-vault`/
    `vault`), so a seed that drifted from the on-chain `b"…"` constants in *both*
    the impl and the in-test v1 reference would still be caught. It holds because
    Kit UTF-8-encodes a `string` seed exactly as v1's
    `textEncoder.encode(...)`, and `getAddressEncoder().encode(address(x))`
    yields the same 32 bytes as v1's `PublicKey#toBytes()`. A new local
    `packages/solana/vitest.config.ts` (mirroring `@helio/api`'s) was added so
    the package's tests stop inheriting the root app's `vite.config.ts` test
    block; this also un-broke the two pre-existing `smart-transaction` tests.
- [~] Phase 3+ (now its own ADR — see [[0005-codama-kit-client]]): Codama Kit client
      from the IDL to retire the Anchor v1 client. **Stages 0–3 landed** — generated
      client committed + byte-for-byte parity-validated against Anchor; hardened Kit RPC
      write surface; full Kit signing pipeline; and the **shipped vault signing path
      (all 8 instructions + the send) is cut over to Kit** in `WalletContext`. Remaining:
      Stage 4 dead-code removal + migrating the Anchor read, and a devnet smoke test.
