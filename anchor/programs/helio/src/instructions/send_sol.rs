use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

use crate::constants::SOL_VAULT_SEED;
use crate::errors::AutoYieldError;
use crate::state::SolVault;
use crate::utils::checked_add_u64;

pub const MIN_SWEEP_BPS: u16 = 10;  // 0.1%
pub const MAX_SWEEP_BPS: u16 = 200; // 2.0%

/// Bundle a SOL transfer to `recipient` with an auto-sweep of `sweep_bps` basis
/// points into the sender's personal vault PDA.  The vault is created on first
/// use — the sender pays the rent.
#[derive(Accounts)]
pub struct SendSol<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: any account may receive SOL; the system program validates the transfer
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + SolVault::INIT_SPACE,
        seeds = [SOL_VAULT_SEED, owner.key().as_ref()],
        bump,
    )]
    pub sol_vault: Account<'info, SolVault>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SendSol>, amount_lamports: u64, sweep_bps: u16) -> Result<()> {
    require!(amount_lamports > 0, AutoYieldError::InvalidSendAmount);
    require!(
        sweep_bps >= MIN_SWEEP_BPS && sweep_bps <= MAX_SWEEP_BPS,
        AutoYieldError::InvalidSweepBps
    );

    // Seed vault owner on first use (init_if_needed leaves fields zeroed when new)
    if ctx.accounts.sol_vault.owner == Pubkey::default() {
        ctx.accounts.sol_vault.owner = ctx.accounts.owner.key();
    }

    // sweep_amount = floor(amount * bps / 10_000), minimum 1 lamport
    let sweep_amount = (amount_lamports as u128)
        .checked_mul(sweep_bps as u128)
        .and_then(|n| n.checked_div(10_000))
        .ok_or(AutoYieldError::ArithmeticOverflow)? as u64;
    let sweep_amount = sweep_amount.max(1);

    // Verify owner has enough for both transfers (fail early with a clear balance error)
    let total_deducted = checked_add_u64(amount_lamports, sweep_amount)?;
    require!(
        ctx.accounts.owner.lamports() >= total_deducted,
        AutoYieldError::InsufficientSolReserve
    );

    // Transfer the main amount to recipient
    system_program::transfer(
        CpiContext::new(
            *ctx.accounts.system_program.key,
            Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.recipient.to_account_info(),
            },
        ),
        amount_lamports,
    )?;

    // Sweep the fee into the user's vault
    system_program::transfer(
        CpiContext::new(
            *ctx.accounts.system_program.key,
            Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.sol_vault.to_account_info(),
            },
        ),
        sweep_amount,
    )?;

    ctx.accounts
        .sol_vault
        .record_swept(sweep_amount, Clock::get()?.unix_timestamp)?;

    Ok(())
}
