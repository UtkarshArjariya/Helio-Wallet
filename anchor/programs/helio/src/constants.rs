pub const CONFIG_SEED: &[u8] = b"config";
pub const RESERVE_SEED: &[u8] = b"reserve";
pub const AUTHORITY_SEED: &[u8] = b"authority";
pub const SOL_VAULT_SEED: &[u8] = b"sol-vault";
pub const STABLE_VAULT_SEED: &[u8] = b"vault";

pub const SWEEP_MODE_ROUND_UP: u8 = 0;
pub const SWEEP_MODE_PERCENTAGE: u8 = 1;

pub const PROTOCOL_KAMINO: u8 = 0;
pub const PROTOCOL_MASK_KAMINO: u16 = 1 << PROTOCOL_KAMINO;
