use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

use crate::constants::{CONFIG_SEED, RESERVE_SEED, SOL_VAULT_SEED};
use crate::errors::AutoYieldError;
use crate::state::{SolVault, UserAutoYieldConfig, UserReserveState};

#[derive(Accounts)]
pub struct SweepSol<'info> {
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
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SweepSol>, amount_lamports: u64) -> Result<()> {
    require!(amount_lamports > 0, AutoYieldError::InvalidSweepAmount);
    ctx.accounts.config.assert_sweeps_enabled()?;

    let transfer_accounts = Transfer {
        from: ctx.accounts.owner.to_account_info(),
        to: ctx.accounts.sol_vault.to_account_info(),
    };
    let transfer_context = CpiContext::new(
        *ctx.accounts.system_program.key,
        transfer_accounts,
    );
    system_program::transfer(transfer_context, amount_lamports)?;

    ctx.accounts
        .reserve_state
        .record_sol_sweep(amount_lamports, Clock::get()?.unix_timestamp)?;

    Ok(())
}
