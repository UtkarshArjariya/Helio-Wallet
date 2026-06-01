use anchor_lang::prelude::Pubkey;
use anchor_lang::pubkey;

pub const CONFIG_SEED: &[u8] = b"config";
pub const RESERVE_SEED: &[u8] = b"reserve";
pub const AUTHORITY_SEED: &[u8] = b"authority";
pub const SOL_VAULT_SEED: &[u8] = b"sol-vault";
pub const STABLE_VAULT_SEED: &[u8] = b"vault";

pub const SWEEP_MODE_ROUND_UP: u8 = 0;
pub const SWEEP_MODE_PERCENTAGE: u8 = 1;

pub const PROTOCOL_KAMINO: u8 = 0;
pub const PROTOCOL_MOCK: u8 = 1;
pub const PROTOCOL_METEORA: u8 = 2;

pub const PROTOCOL_MASK_KAMINO: u16 = 1 << PROTOCOL_KAMINO;
pub const PROTOCOL_MASK_MOCK: u16 = 1 << PROTOCOL_MOCK;
pub const PROTOCOL_MASK_METEORA: u16 = 1 << PROTOCOL_METEORA;

/// Helio-owned mock yield vault program id (devnet-testable AutoYield path).
///
/// MUST equal `declare_id!` in `programs/mock-yield-vault/src/lib.rs` and the
/// `mock_yield_vault` entry in `Anchor.toml`. Derived from
/// `target/deploy/mock_yield_vault-keypair.json` (`anchor keys list`); keep that
/// keypair safe — it defines the deployed program address.
pub const MOCK_VAULT_PROGRAM_ID: Pubkey =
    pubkey!("EQXhez36iW9smfarF4oNTGgRa3iL1Nr7KowgPthujqeM");

/// Meteora Dynamic Vault program id (same on mainnet + devnet per Meteora docs).
/// VERIFIED address; the CPI account-order/args against it are UNVERIFIED for
/// our Anchor 1.0.2 build — confirm before any deploy that targets Meteora.
pub const METEORA_VAULT_PROGRAM_ID: Pubkey =
    pubkey!("24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi");
