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
    /// Principal (in stable atomic units) currently deployed into the active
    /// yield protocol. Increases on deploy, decreases on withdraw.
    pub deployed_atomic: u64,
    /// Outstanding protocol LP tokens held by the reserve authority PDA.
    pub lp_balance: u64,
    pub last_deploy_unix_ts: i64,
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
            deployed_atomic: 0,
            lp_balance: 0,
            last_deploy_unix_ts: 0,
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

    /// Record a deploy of `amount` stable principal into the active protocol,
    /// against which `lp_minted` LP tokens were received. Moves `amount` out of
    /// the liquid stable balance and into `deployed_atomic`, and credits the
    /// received LP. Mirrors `record_stable_*` (all-checked arithmetic).
    pub fn record_protocol_deploy(
        &mut self,
        amount: u64,
        lp_minted: u64,
        timestamp: i64,
    ) -> Result<()> {
        self.stable_balance_atomic = checked_sub_u64(self.stable_balance_atomic, amount)?;
        self.deployed_atomic = checked_add_u64(self.deployed_atomic, amount)?;
        self.lp_balance = checked_add_u64(self.lp_balance, lp_minted)?;
        self.last_deploy_unix_ts = timestamp;
        Ok(())
    }

    /// Record a withdraw of `lp` LP tokens from the active protocol, which
    /// returned `out` stable atomic units. Burns the LP from `lp_balance`,
    /// reduces deployed principal (saturating, since accrued yield can return
    /// more than the recorded principal) and credits the liquid stable balance.
    pub fn record_protocol_withdraw(&mut self, lp: u64, out: u64, timestamp: i64) -> Result<()> {
        self.lp_balance = checked_sub_u64(self.lp_balance, lp)?;
        // Deployed principal can be exceeded by `out` once yield accrues; never
        // underflow — saturate to zero so the field stays a lower bound.
        self.deployed_atomic = self.deployed_atomic.saturating_sub(out);
        self.stable_balance_atomic = checked_add_u64(self.stable_balance_atomic, out)?;
        self.last_withdraw_unix_ts = timestamp;
        Ok(())
    }

    /// Guard a protocol deploy: the reserve must hold at least `amount` of
    /// liquid stable principal to move into the protocol.
    pub fn assert_protocol_deploy_allowed(&self, amount: u64) -> Result<()> {
        require!(
            self.stable_balance_atomic >= amount,
            AutoYieldError::ProtocolDeployNotAllowed
        );
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
            self.sol_balance_lamports == 0
                && self.stable_balance_atomic == 0
                && self.deployed_atomic == 0
                && self.lp_balance == 0,
            AutoYieldError::ReserveNotEmpty
        );
        Ok(())
    }
}
