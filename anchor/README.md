# Helio Anchor Workspace — `helio` program

On-chain reserve program that backs Helio Wallet's **AutoYield** and the
personal-vault SOL sweep used by standard sends.

> Part of [Helio Wallet](../README.md), a non-custodial Solana Chrome extension (MV3, MIT).
> 📱 Mobile app: developed as a separate repo — see `/mobile`.

---

## At a glance

| | |
|---|---|
| **Program name** | `helio` |
| **Program ID** | `EJw2Y8jJwbw1CeHRDRHSeUYzU2L1ke1aqmkQLod5T151` (mock-yield-vault `EQXhez36iW9smfarF4oNTGgRa3iL1Nr7KowgPthujqeM`) |
| **Cluster** | `Status: ⚠️ Partial` — deployed & executable on **devnet**; **not deployed on mainnet (null)** |
| **Source size** | ~1,060 LOC of Rust across `programs/helio/src` |
| **Instructions** | 11 (see below) |
| **Errors** | 24 typed variants (`AutoYieldError` in `src/errors.rs`) |
| **CPIs** | PDA-signed SOL + SPL-token transfers (vault authority is a PDA) |
| **Tests** | ~2,100-line integration suite (`tests/helio.ts`, 2,111 lines) |
| **Toolchain** | Anchor `1.0.2`, Solana `3.1.15` (`Anchor.toml`) |

---

## What it does today (`Status: ⚠️ Partial` — devnet only)

The program maintains **deterministic, per-user PDA vaults** and sweeps small
amounts of value into them so they can later be deployed into yield. Concretely:

- **Per-user state PDAs** for AutoYield config, reserve accounting, a reserve
  authority (the PDA that signs token transfers), a native SOL vault, and a
  stablecoin token vault.
- **Owner-controlled policy** — only the reserve owner can update config, pause,
  resume, sweep, or withdraw (`Unauthorized` everywhere else).
- **SOL sweep** into a PDA-owned native vault.
- **Stablecoin sweep** into a PDA-owned SPL token vault.
- **`send_sol`** — bundles a normal SOL transfer to a recipient **plus** an
  auto-sweep of `sweep_bps` (10–200 bps, i.e. 0.1%–2%) into the sender's
  personal vault, in a single transaction. The vault is created on first use and
  the sender pays its rent. This is the path the live extension uses for standard
  sends (`src/lib/helio-program.ts` → `sendSolPlain`).
- **Owner withdrawals** of SOL and stablecoins back to the wallet, intended to
  feed user-signed Jupiter / Kamino flows.

### What it does **not** do yet

- **No DeFi deployment / staking CPI.** `Status: ❌ Planned` — there is **no
  instruction that deposits into Kamino, Meteora, or MarginFi**. The
  `active_protocol` / `allowed_protocols_mask` / `excluded_protocols_mask` fields
  are **config metadata only**; the only accepted protocol value today is
  `PROTOCOL_KAMINO`, and nothing actually deploys into it. "Deployed" and
  "rewards" accounting therefore stays at `0`.
- **No auto-convert / swap instruction.** `Status: ❌ Planned` — there is no
  on-chain Jupiter swap; conversion is expected to happen via user-signed flows
  off-program.
- **No `close_vault` instruction → rent-reclaim gap.** `Status: ⚠️ Partial` —
  `close_empty_reserve` closes the config + reserve-state accounts once the
  reserve is empty, but there is **no instruction that closes the `sol-vault` /
  stable `vault` token PDAs**, so the rent reserved for those vaults cannot be
  reclaimed. Tracked as a follow-up.

> **Vision (not a current claim):** Helio is "the Solana wallet that thinks
> before it sends, and earns while you sleep." AutoYield's on-chain deployment
> into lending/LP protocols and the headline APY numbers (e.g. an 8.3% Kamino
> target) are **targets/goals**, not shipped behavior.

---

## Instructions (11)

Defined in `programs/helio/src/lib.rs`; one handler module per file under
`src/instructions/`.

| Instruction | Purpose |
|---|---|
| `initialize_auto_yield` | Create the user's config, reserve state, authority, SOL vault, and stable vault PDAs. |
| `update_auto_yield_config` | Update policy fields (sweep mode, thresholds, protocol masks). |
| `pause_auto_yield` | Pause sweeps for the reserve. |
| `resume_auto_yield` | Resume sweeps for the reserve. |
| `sweep_sol` | Move SOL from the owner into the PDA-owned native vault. |
| `sweep_stable` | Move stablecoins into the PDA-owned SPL token vault. |
| `withdraw_sol` | Owner withdrawal of swept SOL (rent-exemption guarded). |
| `withdraw_stable` | Owner withdrawal of swept stablecoins (PDA-signed token transfer). |
| `close_empty_reserve` | Close config + reserve-state accounts when the reserve holds no assets. |
| `send_sol` | Bundle a SOL transfer to a recipient + a 0.1%–2% sweep into the sender's vault. |
| `withdraw_vault_sol` | Withdraw SOL from the personal vault **without** an AutoYield config. |

---

## Errors (24)

All defined as the `AutoYieldError` enum in `src/errors.rs`. Categories:

- **Authorization / ownership** — `Unauthorized`, `ReserveConfigMismatch`.
- **Config validation** — `InvalidConfig`, `InvalidSweepMode`, `InvalidRoundUpUnit`,
  `InvalidPercentageBps`, `InvalidDeployThreshold`, `UnsupportedProtocol`,
  `ActiveProtocolNotAllowed`, `ActiveProtocolExcluded`.
- **State / lifecycle** — `AutoYieldDisabled`, `AutoYieldPaused`, `ReserveNotEmpty`.
- **Amounts / accounting** — `InvalidSweepAmount`, `InvalidWithdrawAmount`,
  `InvalidSendAmount`, `InvalidSweepBps`, `ArithmeticOverflow`,
  `InsufficientSolReserve`, `InsufficientStableReserve`.
- **Account / PDA mismatches** — `InvalidStableMint`, `InvalidSolVault`,
  `InvalidStableVault`, `SolVaultRentViolation`.

---

## PDA seeds

All PDAs are derived per-owner so each user gets an isolated reserve. Seeds are
declared in `src/constants.rs`:

| PDA | Seeds |
|---|---|
| `config` | `[b"config", owner]` |
| `reserve` | `[b"reserve", owner]` |
| `authority` | `[b"authority", owner]` |
| `sol-vault` | `[b"sol-vault", owner]` |
| stable `vault` | `[b"vault", owner, stable_mint]` |

The **`authority`** PDA is the signer for all token-vault CPIs: stable
withdrawals/sweeps call `token::transfer_checked` with the authority's
`[b"authority", owner, bump]` seeds (`with_signer`), so the program — not the
user — authorizes movements out of the SPL token vault.

---

## Extension integration

The extension does **not** rebuild the program; it consumes a **vendored IDL**:

- **IDL:** `src/lib/idl/helio.json` (repo root, vendored).
- **Client:** `src/lib/helio-program.ts` builds and signs the `send_sol` /
  `withdraw_vault_sol` / sweep / withdraw instructions in-page against this
  program ID.

> The pure AutoYield state machine in `@helio/solana` (`auto-yield-program.ts`)
> derives PDAs from this deployed program ID (`EJw2Y8…`); the earlier `Fg6Pa…`
> SPL token-swap example mismatch is resolved.

---

## Layout

```
anchor/
├─ Anchor.toml                 # toolchain + program IDs (devnet + localnet)
├─ Cargo.toml / Cargo.lock     # workspace manifest
├─ programs/helio/
│  └─ src/
│     ├─ lib.rs                # #[program] — the 11 instruction entrypoints
│     ├─ constants.rs          # PDA seeds, sweep modes, protocol constants
│     ├─ errors.rs             # AutoYieldError (24 variants)
│     ├─ utils.rs              # checked arithmetic, protocol mask helpers
│     ├─ instructions/         # one handler module per instruction
│     └─ state/                # config, reserve, sol_vault account layouts
└─ tests/helio.ts              # ~2,100-line integration suite
```

---

## Build & test

> **Scaffolded manually.** This workspace was authored by hand because the build
> machine did **not** have the `anchor` or `cargo` CLIs installed. The sources,
> `Anchor.toml`, `Cargo.toml`, IDL, and tests are complete, but you must install
> the toolchain locally to compile, deploy, or run the test suite. The on-chain
> bytecode currently on **devnet** was deployed out of band.

### Prerequisites

- Rust toolchain with `cargo`
- Solana CLI (`solana` `3.1.15`)
- Anchor CLI (`anchor` `1.0.2`)

### Commands

```bash
# Build the program
anchor build

# Run the integration test suite (ts-mocha, see Anchor.toml [scripts].test)
anchor test
# or, against an already-running validator:
npx ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts

# Deploy to devnet (program ID is pinned in Anchor.toml)
anchor deploy --provider.cluster devnet
```

After a rebuild, refresh the vendored IDL the extension consumes:

```bash
cp target/idl/helio.json ../src/lib/idl/helio.json
```

---

## Status summary

| Capability | Status |
|---|---|
| Per-user PDA vaults (SOL + stable) | `Status: ✅ Built` (devnet) |
| `send_sol` personal-vault sweep (live send path) | `Status: ✅ Built` (devnet) |
| AutoYield init / pause / resume / config / sweep / withdraw | `Status: ⚠️ Partial` (devnet only; `deployed`/`rewards` always `0`) |
| DeFi deploy / stake CPI (Kamino / Meteora / MarginFi) | `Status: ❌ Planned` |
| On-chain swap / auto-convert | `Status: ❌ Planned` |
| `close_vault` (rent reclaim for vault PDAs) | `Status: ❌ Planned` (rent-reclaim gap) |
| Mainnet deployment | `Status: ❌ Planned` (null on mainnet) |
