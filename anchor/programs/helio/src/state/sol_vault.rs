use anchor_lang::prelude::*;

use crate::utils::checked_add_u64;

#[account]
#[derive(InitSpace)]
pub struct SolVault {
    pub owner: Pubkey,
    pub total_swept_lamports: u64,
    pub last_swept_unix_ts: i64,
}

impl SolVault {
    pub fn new(owner: Pubkey) -> Self {
        Self {
            owner,
            total_swept_lamports: 0,
            last_swept_unix_ts: 0,
        }
    }

    pub fn record_swept(&mut self, amount: u64, timestamp: i64) -> Result<()> {
        self.total_swept_lamports = checked_add_u64(self.total_swept_lamports, amount)?;
        self.last_swept_unix_ts = timestamp;
        Ok(())
    }
}
