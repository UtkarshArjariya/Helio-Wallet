# ADR-0006: AutoYield program devnet redeploy (Path B, fresh id) + pre-deploy hardening

- **Status:** Accepted; committed. Build + `program_autofixer` + full app matrix green;
  adversarial review verdict **ship**. **Deployed to devnet 2026-06-01** — helio
  `EJw2Y8…` (ProgramData `EjNX6hoL…`) + mock `EQXhez36…` (ProgramData `CPs6iwEo…`),
  upgrade authority = the deployer `4MdsSMupveLoUzsYPH6nbxfeo7ddkgje2rPAQ6AfKBMo`
  (`keys/devnet-deployer-keypair.json`). DeFi-flow on-chain test still pending.
- **Relates:** [[0004-kit-migration]], [[0005-codama-kit-client]].

## Context

To deploy the **DeFi-deploy flow** (`deploy_to_protocol` / `withdraw_from_protocol`
+ the Helio-owned `mock-yield-vault`) to devnet for testing, a real `anchor build`
surfaced two hard blockers a source-only audit missed, plus a cluster of medium
accounting/lifecycle bugs:

- **Program-id reality.** Source `declare_id!` = `Bc5g2…` (the already-live,
  smoke-tested devnet program), but the repo holds no `Bc5g2…` keypair (its upgrade
  authority is off-repo). The only in-repo keypair resolves to `EJw2Y8…`.
- **Mock vault id was an undeployable placeholder** (`MockYV1111…`), hard-pinned by
  `resolve_protocol_program` → every `PROTOCOL_MOCK` CPI fails closed.
- **Toolchain correction:** `anchor` 1.0.2 + `cargo` 1.95.0 ARE installed here
  (CLAUDE.md §3 / the monorepo-verify memory said otherwise — that is stale).

## Decision

**Path B — fresh deploy at a new program id**, rather than upgrading the off-repo
`Bc5g2…`. Wire the fresh ids consistently everywhere and harden the program first.

### Program ids (from `anchor/target/deploy/*-keypair.json`, `anchor keys sync`)
- `helio` = **`EJw2Y8jJwbw1CeHRDRHSeUYzU2L1ke1aqmkQLod5T151`**
- `mock_yield_vault` = **`EQXhez36iW9smfarF4oNTGgRa3iL1Nr7KowgPthujqeM`**

Synced across: both `declare_id!`s, `Anchor.toml` `[programs.devnet]`+`[programs.localnet]`,
helio `constants.rs::MOCK_VAULT_PROGRAM_ID`, the vendored IDL `address`, the app
constants (`src/lib/helio-program.ts`, `packages/solana/.../auto-yield-program.ts`),
the **regenerated** Codama Kit client, and the test fixtures (parity `PROGRAM_ID` +
the regenerated GOLDEN PDAs). `Anchor.toml` `provider.cluster = devnet`,
`solana_version = 3.1.14`. **Keep both `target/deploy/*-keypair.json` safe — they ARE
the addresses.**

### Pre-deploy program fixes (all `program_autofixer`-clean, review-verified)
1. **SOL ledger source-of-truth = real lamports.** `withdraw_sol` drops the advisory
   `reserve_state.sol_balance_lamports` gate and bounds on the real vault balance
   (`assert_sol_vault_rent_exempt`); `record_sol_withdrawal` is `saturating_sub`. Fixes
   `withdraw_sol` reverting for `send_sol`-funded reserves.
2. **`close_empty_reserve` un-bricked.** Validates the real `sol_vault` lamports
   (`<= minimum_balance(data_len)`) instead of the stale counter; `assert_empty` no
   longer checks the SOL counter. (`withdraw_vault_sol` bypassing the counter previously
   bricked close forever.)
3. **`withdraw_from_protocol` exit ungated** from `assert_sweeps_enabled()` (kept on the
   `deploy_to_protocol` entry) — pausing AutoYield no longer traps deployed principal.
4. **`send_sol` reinit guard** on the `init_if_needed` sol_vault (mirrors `initialize.rs`).
5. **BPF stack-frame fix:** `DeployToProtocol::try_accounts` overflowed the 4 KB frame by
   464 bytes (runtime-UB risk). `Box`-ed the 7 deserializable accounts in
   `deploy_to_protocol` + `withdraw_from_protocol` (metadata-transparent — IDL/account
   metas unchanged). Build is now 0-error / 0-warning.

### Deferred (non-blocking, recorded not done)
- Token-2022 `InterfaceAccount` migration of the 4 classic-token instructions
  (`program_autofixer` `anchor-account-not-interface`) — Helio uses classic-Token USDC;
  **SPL-Token-only is an accepted decision** (ADR-0004/audit nice-to-have).
- Full `protocol_vault` pinning (store selected vault in `reserve_state` + `require_keys_eq`)
  — matters for permissionless/Meteora protocols; the mock vault is PDA-bound + mint-bound.
- Parity test coverage for the 2 new instructions; `assert_sol_available` is now unused
  (`pub fn`, no warning); README/architecture.md still cite the old id + `Fg6Pa` issue.

## Devnet deploy + upgrade runbook

**Initial deploy** (DONE 2026-06-01 — both programs are live; kept for reproducibility).
`anchor deploy` reads `target/deploy/<prog>-keypair.json` for the addresses and makes
`--provider.wallet` the payer **and** the upgrade authority:
```sh
cd anchor
anchor build                              # 0-err/0-warn; emits target/deploy/*.so + idl
# deployer must hold ~6 devnet SOL (program-data rent for both .so at the default 2x alloc)
anchor deploy --provider.cluster devnet \
  --provider.wallet ../keys/devnet-deployer-keypair.json   # → helio EJw2Y8 + mock EQXhez36; authority = 4Mds…
```

**Upgrade** an already-deployed program. anchor 1.0.2 syntax: `<PROGRAM_ID>` is a
**positional** arg and the binary is passed via `--program-filepath` — NOT the pre-1.0
`anchor upgrade <so> --program-id <id>` form (that flag no longer exists):
```sh
anchor build
anchor program upgrade EJw2Y8jJwbw1CeHRDRHSeUYzU2L1ke1aqmkQLod5T151 \
  --program-filepath target/deploy/helio.so \
  --provider.cluster devnet \
  --provider.wallet ../keys/devnet-deployer-keypair.json    # --upgrade-authority defaults to this wallet (4Mds…)
# if the IDL changed too:
# anchor idl upgrade EJw2Y8jJwbw1CeHRDRHSeUYzU2L1ke1aqmkQLod5T151 \
#   --filepath target/idl/helio.json --provider.cluster devnet --provider.wallet ../keys/devnet-deployer-keypair.json
```
The app already targets `EJw2Y8…` (the old `Bc5g2…` stays live but unreferenced). **Next:**
from the app, init a vault per stable mint → `deploy_to_protocol` → `withdraw_from_protocol`
against the mock vault `EQXhez36…`. For a LOCAL run use `anchor test --provider.cluster
localnet`; the existing `tests/helio.ts` encodes some now-fixed behaviors (e.g. the
close-brick at ~`:1898`) and needs updating first.

## Consequences
- **+** DeFi-deploy flow becomes deployable + testable on devnet; ledger/close/exit bugs
  fixed; stack-frame UB removed; program-id wiring consistent end-to-end.
- **−** Fresh id orphans the live `Bc5g2…` program; the app must re-init vaults on the new
  `EJw2Y8…` program (now deployed 2026-06-01). The earlier `Bc5g2…` devnet smoke runs no
  longer apply. Back up `keys/devnet-deployer-keypair.json` (upgrade authority) + both
  `anchor/target/deploy/*-keypair.json` (program addresses) — none are committed (gitignored).
- **−** `tests/helio.ts` (local) needs updating to the corrected behaviors before `anchor test`.
