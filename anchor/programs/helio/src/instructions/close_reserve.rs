use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount};

use crate::constants::{
    AUTHORITY_SEED, CONFIG_SEED, RESERVE_SEED, SOL_VAULT_SEED, STABLE_VAULT_SEED,
};
use crate::errors::AutoYieldError;
use crate::state::{SolVault, UserAutoYieldConfig, UserReserveState};
use crate::utils::find_reserve_authority_bump;

#[derive(Accounts)]
pub struct CloseEmptyReserve<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        close = owner,
        seeds = [CONFIG_SEED, owner.key().as_ref()],
        bump,
        constraint = config.owner == owner.key() @ AutoYieldError::Unauthorized
    )]
    pub config: Account<'info, UserAutoYieldConfig>,
    #[account(
        mut,
        close = owner,
        seeds = [RESERVE_SEED, owner.key().as_ref()],
        bump,
        constraint = reserve_state.owner == owner.key() @ AutoYieldError::Unauthorized,
        constraint = reserve_state.config == config.key() @ AutoYieldError::ReserveConfigMismatch,
        constraint = reserve_state.sol_vault == sol_vault.key() @ AutoYieldError::InvalidSolVault,
        constraint = reserve_state.stable_vault == stable_vault.key() @ AutoYieldError::InvalidStableVault
    )]
    pub reserve_state: Account<'info, UserReserveState>,
    #[account(
        mut,
        close = owner,
        seeds = [SOL_VAULT_SEED, owner.key().as_ref()],
        bump,
        constraint = sol_vault.owner == owner.key() @ AutoYieldError::Unauthorized
    )]
    pub sol_vault: Account<'info, SolVault>,
    #[account(address = config.preferred_stable_mint @ AutoYieldError::InvalidStableMint)]
    pub stable_mint: Account<'info, Mint>,
    /// CHECK: This PDA only signs token vault withdrawals for the program.
    #[account(seeds = [AUTHORITY_SEED, owner.key().as_ref()], bump)]
    pub reserve_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [STABLE_VAULT_SEED, owner.key().as_ref(), stable_mint.key().as_ref()],
        bump,
        token::mint = stable_mint,
        token::authority = reserve_authority
    )]
    pub stable_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<CloseEmptyReserve>) -> Result<()> {
    ctx.accounts.reserve_state.assert_empty()?;
    require!(
        ctx.accounts.stable_vault.amount == 0,
        AutoYieldError::ReserveNotEmpty
    );

    let owner_key = ctx.accounts.owner.key();
    let reserve_authority_bump =
        find_reserve_authority_bump(&owner_key, ctx.program_id);
    let bump_seed = [reserve_authority_bump];
    let signer_seeds: &[&[u8]] = &[AUTHORITY_SEED, owner_key.as_ref(), &bump_seed];
    let signers = [signer_seeds];

    let close_accounts = CloseAccount {
        account: ctx.accounts.stable_vault.to_account_info(),
        destination: ctx.accounts.owner.to_account_info(),
        authority: ctx.accounts.reserve_authority.to_account_info(),
    };
    let close_context = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        close_accounts,
    )
    .with_signer(&signers);

    token::close_account(close_context)?;
    Ok(())
}
