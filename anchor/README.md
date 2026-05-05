# Helio AutoYield Anchor Workspace

This folder contains the on-chain reserve program for Helio AutoYield.

Current scope:
- deterministic user PDAs for config, reserve state, reserve authority, SOL vault, and stable vault
- owner-controlled policy updates
- SOL sweep into a PDA-owned vault
- stablecoin sweep into a PDA-owned token vault
- owner withdrawals back to the wallet for user-signed Jupiter and Kamino flows

PDA seeds:
- `config`: `[b"config", owner]`
- `reserve`: `[b"reserve", owner]`
- `authority`: `[b"authority", owner]`
- `sol-vault`: `[b"sol-vault", owner]`
- `vault`: `[b"vault", owner, stable_mint]`

Build prerequisites:
- Rust toolchain with `cargo`
- Solana CLI
- Anchor CLI

This workspace was scaffolded manually because the local machine does not currently have `anchor` or `cargo` installed.
