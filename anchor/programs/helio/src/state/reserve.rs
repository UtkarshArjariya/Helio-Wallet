use anchor_lang::prelude::*;

use crate::errors::AutoYieldError;
use crate::utils::{checked_add_u64, checked_sub_u64};

#[account]
#[derive(InitSpace)]
pub struct UserReserveState {
    pub owner: Pubkey,
    pub config: Pubkey,
    pub sol_vault: Pubkey,
    pub stable_vault: Pubkey,
    pub sol_balance_lamports: u64,
    pub stable_balance_atomic: u64,
    pub total_swept_sol_lamports: u64,
    pub total_swept_stable_atomic: u64,
    pub last_sweep_unix_ts: i64,
    pub last_withdraw_unix_ts: i64,
}

impl UserReserveState {
    pub fn new(
        owner: Pubkey,
        config: Pubkey,
        sol_vault: Pubkey,
        stable_vault: Pubkey,
    ) -> Self {
        Self {
            owner,
            config,
            sol_vault,
            stable_vault,
            sol_balance_lamports: 0,
            stable_balance_atomic: 0,
            total_swept_sol_lamports: 0,
            total_swept_stable_atomic: 0,
            last_sweep_unix_ts: 0,
            last_withdraw_unix_ts: 0,
        }
    }

    pub fn record_sol_sweep(&mut self, amount: u64, timestamp: i64) -> Result<()> {
        self.sol_balance_lamports = checked_add_u64(self.sol_balance_lamports, amount)?;
        self.total_swept_sol_lamports =
            checked_add_u64(self.total_swept_sol_lamports, amount)?;
        self.last_sweep_unix_ts = timestamp;
        Ok(())
    }

    pub fn record_stable_sweep(&mut self, amount: u64, timestamp: i64) -> Result<()> {
        self.stable_balance_atomic = checked_add_u64(self.stable_balance_atomic, amount)?;
        self.total_swept_stable_atomic =
            checked_add_u64(self.total_swept_stable_atomic, amount)?;
        self.last_sweep_unix_ts = timestamp;
        Ok(())
    }

    pub fn record_sol_withdrawal(&mut self, amount: u64, timestamp: i64) -> Result<()> {
        self.sol_balance_lamports = checked_sub_u64(self.sol_balance_lamports, amount)?;
        self.last_withdraw_unix_ts = timestamp;
        Ok(())
    }

    pub fn record_stable_withdrawal(&mut self, amount: u64, timestamp: i64) -> Result<()> {
        self.stable_balance_atomic = checked_sub_u64(self.stable_balance_atomic, amount)?;
        self.last_withdraw_unix_ts = timestamp;
        Ok(())
    }

    pub fn assert_sol_available(&self, amount: u64) -> Result<()> {
        require!(
            self.sol_balance_lamports >= amount,
            AutoYieldError::InsufficientSolReserve
        );
        Ok(())
    }

    pub fn assert_stable_available(&self, amount: u64) -> Result<()> {
        require!(
            self.stable_balance_atomic >= amount,
            AutoYieldError::InsufficientStableReserve
        );
        Ok(())
    }

    pub fn assert_empty(&self) -> Result<()> {
        require!(
            self.sol_balance_lamports == 0 && self.stable_balance_atomic == 0,
            AutoYieldError::ReserveNotEmpty
        );
        Ok(())
    }
}
