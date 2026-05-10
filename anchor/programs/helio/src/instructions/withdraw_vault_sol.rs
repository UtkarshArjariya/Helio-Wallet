use anchor_lang::prelude::*;

use crate::constants::SOL_VAULT_SEED;
use crate::errors::AutoYieldError;
use crate::state::SolVault;
use crate::utils::{assert_sol_vault_rent_exempt, move_lamports};

/// Withdraw SOL directly from the personal vault PDA.  Does not require
/// AutoYield config or reserve state — usable by wallets that only ever called
/// `send_sol`.
#[derive(Accounts)]
pub struct WithdrawVaultSol<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [SOL_VAULT_SEED, owner.key().as_ref()],
        bump,
        constraint = sol_vault.owner == owner.key() @ AutoYieldError::Unauthorized,
    )]
    pub sol_vault: Account<'info, SolVault>,
}

pub fn handler(ctx: Context<WithdrawVaultSol>, amount_lamports: u64) -> Result<()> {
    require!(amount_lamports > 0, AutoYieldError::InvalidWithdrawAmount);

    assert_sol_vault_rent_exempt(&ctx.accounts.sol_vault.to_account_info(), amount_lamports)?;

    move_lamports(
        &ctx.accounts.sol_vault.to_account_info(),
        &ctx.accounts.owner.to_account_info(),
        amount_lamports,
    )?;

    Ok(())
}
