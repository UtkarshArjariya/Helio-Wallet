use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::{
    AUTHORITY_SEED, CONFIG_SEED, RESERVE_SEED, STABLE_VAULT_SEED,
};
use crate::errors::AutoYieldError;
use crate::state::{UserAutoYieldConfig, UserReserveState};

#[derive(Accounts)]
pub struct WithdrawStable<'info> {
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
        constraint = reserve_state.stable_vault == stable_vault.key() @ AutoYieldError::InvalidStableVault
    )]
    pub reserve_state: Account<'info, UserReserveState>,
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
    #[account(
        mut,
        token::mint = stable_mint,
        token::authority = owner
    )]
    pub owner_stable_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<WithdrawStable>, amount_atomic: u64) -> Result<()> {
    require!(amount_atomic > 0, AutoYieldError::InvalidWithdrawAmount);
    ctx.accounts
        .reserve_state
        .assert_stable_available(amount_atomic)?;

    let owner_key = ctx.accounts.owner.key();
    let bump_seed = [ctx.bumps.reserve_authority];
    let signer_seeds: &[&[u8]] = &[AUTHORITY_SEED, owner_key.as_ref(), &bump_seed];
    let signers = [signer_seeds];

    let transfer_accounts = TransferChecked {
        from: ctx.accounts.stable_vault.to_account_info(),
        mint: ctx.accounts.stable_mint.to_account_info(),
        to: ctx.accounts.owner_stable_account.to_account_info(),
        authority: ctx.accounts.reserve_authority.to_account_info(),
    };
    let transfer_context = CpiContext::new(
        *ctx.accounts.token_program.key,
        transfer_accounts,
    )
    .with_signer(&signers);

    token::transfer_checked(
        transfer_context,
        amount_atomic,
        ctx.accounts.stable_mint.decimals,
    )?;

    ctx.accounts
        .reserve_state
        .record_stable_withdrawal(amount_atomic, Clock::get()?.unix_timestamp)?;

    Ok(())
}
