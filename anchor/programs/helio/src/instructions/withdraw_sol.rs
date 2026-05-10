use anchor_lang::prelude::*;

use crate::constants::{CONFIG_SEED, RESERVE_SEED, SOL_VAULT_SEED};
use crate::errors::AutoYieldError;
use crate::state::{SolVault, UserAutoYieldConfig, UserReserveState};
use crate::utils::{assert_sol_vault_rent_exempt, move_lamports};

#[derive(Accounts)]
pub struct WithdrawSol<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED, owner.key().as_ref()],
        bump,
        constraint = config.owner == owner.key() @ AutoYieldError::Unauthorized
    )]
    pub config: Account<'info, UserAutoYieldConfig>,
    #[account(
        mut,
        seeds = [RESERVE_SEED, owner.key().as_ref()],
        bump,
        constraint = reserve_state.owner == owner.key() @ AutoYieldError::Unauthorized,
        constraint = reserve_state.config == config.key() @ AutoYieldError::ReserveConfigMismatch,
        constraint = reserve_state.sol_vault == sol_vault.key() @ AutoYieldError::InvalidSolVault
    )]
    pub reserve_state: Account<'info, UserReserveState>,
    #[account(
        mut,
        seeds = [SOL_VAULT_SEED, owner.key().as_ref()],
        bump,
        constraint = sol_vault.owner == owner.key() @ AutoYieldError::Unauthorized
    )]
    pub sol_vault: Account<'info, SolVault>,
}

pub fn handler(ctx: Context<WithdrawSol>, amount_lamports: u64) -> Result<()> {
    require!(amount_lamports > 0, AutoYieldError::InvalidWithdrawAmount);
    ctx.accounts
        .reserve_state
        .assert_sol_available(amount_lamports)?;
    assert_sol_vault_rent_exempt(
        &ctx.accounts.sol_vault.to_account_info(),
        amount_lamports,
    )?;

    move_lamports(
        &ctx.accounts.sol_vault.to_account_info(),
        &ctx.accounts.owner.to_account_info(),
        amount_lamports,
    )?;

    ctx.accounts
        .reserve_state
        .record_sol_withdrawal(amount_lamports, Clock::get()?.unix_timestamp)?;

    Ok(())
}
