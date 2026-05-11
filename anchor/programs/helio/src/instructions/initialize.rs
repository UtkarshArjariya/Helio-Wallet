use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::{
    AUTHORITY_SEED, CONFIG_SEED, RESERVE_SEED, SOL_VAULT_SEED, STABLE_VAULT_SEED,
};
use crate::errors::AutoYieldError;
use crate::state::{AutoYieldConfigArgs, SolVault, UserAutoYieldConfig, UserReserveState};

#[derive(Accounts)]
pub struct InitializeAutoYield<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + UserAutoYieldConfig::INIT_SPACE,
        seeds = [CONFIG_SEED, owner.key().as_ref()],
        bump
    )]
    pub config: Account<'info, UserAutoYieldConfig>,
    #[account(
        init,
        payer = owner,
        space = 8 + UserReserveState::INIT_SPACE,
        seeds = [RESERVE_SEED, owner.key().as_ref()],
        bump
    )]
    pub reserve_state: Account<'info, UserReserveState>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + SolVault::INIT_SPACE,
        seeds = [SOL_VAULT_SEED, owner.key().as_ref()],
        bump,
        constraint = (
            sol_vault.owner == Pubkey::default()
                || sol_vault.owner == owner.key()
        ) @ AutoYieldError::Unauthorized
    )]
    pub sol_vault: Account<'info, SolVault>,
    /// CHECK: This PDA only signs token vault withdrawals for the program.
    #[account(seeds = [AUTHORITY_SEED, owner.key().as_ref()], bump)]
    pub reserve_authority: UncheckedAccount<'info>,
    #[account(
        init,
        payer = owner,
        seeds = [STABLE_VAULT_SEED, owner.key().as_ref(), stable_mint.key().as_ref()],
        bump,
        token::mint = stable_mint,
        token::authority = reserve_authority
    )]
    pub stable_vault: Account<'info, TokenAccount>,
    pub stable_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeAutoYield>, args: AutoYieldConfigArgs) -> Result<()> {
    args.validate()?;

    ctx.accounts.config.set_inner(UserAutoYieldConfig::new(
        ctx.accounts.owner.key(),
        ctx.accounts.stable_mint.key(),
        args,
    ));
    ctx.accounts.reserve_state.set_inner(UserReserveState::new(
        ctx.accounts.owner.key(),
        ctx.accounts.config.key(),
        ctx.accounts.sol_vault.key(),
        ctx.accounts.stable_vault.key(),
    ));

    // Only seed the vault on first init — preserves accounting if send_sol
    // created the vault earlier. Owner is already constrained above.
    if ctx.accounts.sol_vault.owner == Pubkey::default() {
        ctx.accounts.sol_vault.owner = ctx.accounts.owner.key();
    }

    Ok(())
}
