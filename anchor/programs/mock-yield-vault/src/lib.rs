// Helio-owned MOCK single-asset yield vault.
//
// Purpose: a devnet-testable stand-in for Meteora's Dynamic Vault that exposes
// the SAME deposit/withdraw account+arg shape (7-account `(amount, min_lp)`
// deposit / `(lp, min_out)` withdraw) so the `helio` program's
// `deploy_to_protocol` / `withdraw_from_protocol` CPIs can target it UNCHANGED.
// Yield is simulated by an admin-only `accrue` that raises `virtual_price` and
// credits the vault's token reserve, so withdrawing LP returns more underlying.
//
// SECURITY MODEL (mirrors the build-defi-protocol non-negotiables):
//  - All value math is checked; LP/underlying conversions round in the vault's
//    favour (deposit -> floor LP minted; withdraw -> floor underlying out).
//  - The vault PDA is the sole authority over the token reserve and LP mint.
//  - Emergency `paused` flag blocks deposits AND withdrawals.
//  - Non-zero slippage bounds enforced (min_lp_out / min_out must be > 0).
//
// Anchor's macro-generated __client_accounts_* modules re-export `handler`-style
// symbols via glob; suppress the same lints the helio crate suppresses.
#![allow(ambiguous_glob_reexports)]
#![allow(unexpected_cfgs)]
// The 7-account (amount, min_lp) shape mirrors Meteora's vault deposit, which
// uses the (deprecated-but-supported) `transfer` (no mint account in the set).
// Keeping it preserves the "same CPI shape" goal; switching to transfer_checked
// would add a mint account and break parity. Math + slippage are still checked.
#![allow(deprecated)]

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, Burn, Mint, MintTo, TokenAccount, TokenInterface, Transfer,
};

// Placeholder program id — REGENERATE with `anchor keys list` after the first
// `anchor build`/deploy and update this + Anchor.toml. UNVERIFIED until deploy.
declare_id!("MockYV1111111111111111111111111111111111111");

/// PDA seeds.
pub const VAULT_SEED: &[u8] = b"mock-vault";
pub const TOKEN_VAULT_SEED: &[u8] = b"token_vault";
pub const LP_MINT_SEED: &[u8] = b"lp_mint";

/// Fixed-point scale for `virtual_price` (1 LP unit price == PRICE_SCALE).
/// At init the price is exactly 1.0 (PRICE_SCALE). Yield raises it.
pub const PRICE_SCALE: u64 = 1_000_000;

#[program]
pub mod mock_yield_vault {
    use super::*;

    /// Initialize a vault for a single token mint. The vault PDA owns both the
    /// reserve token account and the LP mint.
    ///
    /// # Errors
    /// Propagates account-init / SPL errors from Anchor constraints.
    pub fn init_vault(ctx: Context<InitVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.authority.key();
        vault.token_mint = ctx.accounts.token_mint.key();
        vault.token_vault = ctx.accounts.token_vault.key();
        vault.lp_mint = ctx.accounts.lp_mint.key();
        vault.total_deposited = 0;
        vault.virtual_price = PRICE_SCALE;
        vault.paused = false;
        vault.vault_bump = ctx.bumps.vault;
        Ok(())
    }

    /// Deposit `amount` underlying tokens and mint LP to the caller.
    ///
    /// LP minted = floor(amount * PRICE_SCALE / virtual_price) — rounds DOWN so
    /// the vault never over-issues LP. `min_lp_out` enforces caller slippage.
    ///
    /// # Errors
    /// - `MockVaultError::ZeroAmount` if `amount == 0`.
    /// - `MockVaultError::SlippageThresholdZero` if `min_lp_out == 0`.
    /// - `MockVaultError::VaultPaused` if the vault is paused.
    /// - `MockVaultError::ExceededSlippage` if minted LP < `min_lp_out`.
    /// - `MockVaultError::MathOverflow` on any checked-arithmetic failure.
    pub fn deposit(ctx: Context<DepositWithdraw>, amount: u64, min_lp_out: u64) -> Result<()> {
        require!(amount > 0, MockVaultError::ZeroAmount);
        require!(min_lp_out > 0, MockVaultError::SlippageThresholdZero);
        require!(!ctx.accounts.vault.paused, MockVaultError::VaultPaused);

        // Effects-before-interactions is not possible for the mint (we need the
        // CPI to move value); instead we compute first, then do the value moves,
        // then record. LP = floor(amount * PRICE_SCALE / virtual_price).
        let virtual_price = ctx.accounts.vault.virtual_price;
        let lp_to_mint = (amount as u128)
            .checked_mul(PRICE_SCALE as u128)
            .and_then(|n| n.checked_div(virtual_price as u128))
            .ok_or(MockVaultError::MathOverflow)?;
        let lp_to_mint = u64::try_from(lp_to_mint).map_err(|_| MockVaultError::MathOverflow)?;
        require!(lp_to_mint >= min_lp_out, MockVaultError::ExceededSlippage);
        require!(lp_to_mint > 0, MockVaultError::ZeroAmount);

        // Pull underlying from the user into the reserve (user signs). In Anchor
        // 1.0.2 `CpiContext::new` takes the program *Pubkey* (`.key()`).
        token_interface::transfer(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.user_token.to_account_info(),
                    to: ctx.accounts.token_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        // Mint LP to the user (vault PDA signs).
        let mint_key = ctx.accounts.vault.token_mint;
        let bump = ctx.accounts.vault.vault_bump;
        let signer_seeds: &[&[&[u8]]] = &[&[VAULT_SEED, mint_key.as_ref(), &[bump]]];
        token_interface::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                MintTo {
                    mint: ctx.accounts.lp_mint.to_account_info(),
                    to: ctx.accounts.user_lp.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            lp_to_mint,
        )?;

        let vault = &mut ctx.accounts.vault;
        vault.total_deposited = vault
            .total_deposited
            .checked_add(amount)
            .ok_or(MockVaultError::MathOverflow)?;
        Ok(())
    }

    /// Burn `lp_amount` LP and return underlying tokens to the caller.
    ///
    /// underlying out = floor(lp_amount * virtual_price / PRICE_SCALE) — rounds
    /// DOWN so the vault never over-pays. `min_out` enforces caller slippage.
    ///
    /// # Errors
    /// - `MockVaultError::ZeroAmount` if `lp_amount == 0`.
    /// - `MockVaultError::SlippageThresholdZero` if `min_out == 0`.
    /// - `MockVaultError::VaultPaused` if the vault is paused.
    /// - `MockVaultError::ExceededSlippage` if underlying out < `min_out`.
    /// - `MockVaultError::MathOverflow` on any checked-arithmetic failure.
    pub fn withdraw(ctx: Context<DepositWithdraw>, lp_amount: u64, min_out: u64) -> Result<()> {
        require!(lp_amount > 0, MockVaultError::ZeroAmount);
        require!(min_out > 0, MockVaultError::SlippageThresholdZero);
        require!(!ctx.accounts.vault.paused, MockVaultError::VaultPaused);

        let virtual_price = ctx.accounts.vault.virtual_price;
        let out = (lp_amount as u128)
            .checked_mul(virtual_price as u128)
            .and_then(|n| n.checked_div(PRICE_SCALE as u128))
            .ok_or(MockVaultError::MathOverflow)?;
        let out = u64::try_from(out).map_err(|_| MockVaultError::MathOverflow)?;
        require!(out >= min_out, MockVaultError::ExceededSlippage);
        require!(out > 0, MockVaultError::ZeroAmount);

        // Burn the user's LP first (user signs) — effects before paying out.
        token_interface::burn(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                Burn {
                    mint: ctx.accounts.lp_mint.to_account_info(),
                    from: ctx.accounts.user_lp.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            lp_amount,
        )?;

        // Pay out underlying from the reserve (vault PDA signs).
        let mint_key = ctx.accounts.vault.token_mint;
        let bump = ctx.accounts.vault.vault_bump;
        let signer_seeds: &[&[&[u8]]] = &[&[VAULT_SEED, mint_key.as_ref(), &[bump]]];
        token_interface::transfer(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.token_vault.to_account_info(),
                    to: ctx.accounts.user_token.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            out,
        )?;

        let vault = &mut ctx.accounts.vault;
        // total_deposited tracks principal; saturate at 0 since accrued yield
        // can push paid-out underlying above recorded principal.
        vault.total_deposited = vault.total_deposited.saturating_sub(out);
        Ok(())
    }

    /// Admin-only: simulate yield by raising `virtual_price` by `bps` basis
    /// points and crediting matching underlying into the reserve from the
    /// admin's token account, so the vault stays solvent for the new price.
    ///
    /// # Errors
    /// - `MockVaultError::Unauthorized` if signer is not the vault authority.
    /// - `MockVaultError::ZeroAmount` if `bps == 0`.
    /// - `MockVaultError::MathOverflow` on any checked-arithmetic failure.
    pub fn accrue(ctx: Context<Accrue>, bps: u16) -> Result<()> {
        require!(bps > 0, MockVaultError::ZeroAmount);
        // Authority is enforced declaratively via `has_one = authority` on the
        // vault account (see the Accrue accounts struct).

        let old_price = ctx.accounts.vault.virtual_price;
        // new_price = old_price * (10_000 + bps) / 10_000  (rounds down).
        let new_price = (old_price as u128)
            .checked_mul(10_000u128.checked_add(bps as u128).ok_or(MockVaultError::MathOverflow)?)
            .and_then(|n| n.checked_div(10_000))
            .ok_or(MockVaultError::MathOverflow)?;
        let new_price = u64::try_from(new_price).map_err(|_| MockVaultError::MathOverflow)?;

        // Credit the reserve with the simulated profit on current principal so
        // outstanding LP remains fully backed at the new price.
        let principal = ctx.accounts.vault.total_deposited;
        let credit = (principal as u128)
            .checked_mul(bps as u128)
            .and_then(|n| n.checked_div(10_000))
            .ok_or(MockVaultError::MathOverflow)?;
        let credit = u64::try_from(credit).map_err(|_| MockVaultError::MathOverflow)?;

        if credit > 0 {
            token_interface::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.key(),
                    Transfer {
                        from: ctx.accounts.funder_token.to_account_info(),
                        to: ctx.accounts.token_vault.to_account_info(),
                        authority: ctx.accounts.authority.to_account_info(),
                    },
                ),
                credit,
            )?;
        }

        let vault = &mut ctx.accounts.vault;
        vault.virtual_price = new_price;
        vault.total_deposited = vault
            .total_deposited
            .checked_add(credit)
            .ok_or(MockVaultError::MathOverflow)?;
        Ok(())
    }

    /// Admin-only emergency pause/unpause toggle.
    ///
    /// # Errors
    /// - `MockVaultError::Unauthorized` if signer is not the vault authority.
    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        // Authority is enforced declaratively via `has_one = authority` on the
        // vault account (see the SetPaused accounts struct).
        ctx.accounts.vault.paused = paused;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + MockVault::INIT_SPACE,
        seeds = [VAULT_SEED, token_mint.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, MockVault>,
    pub token_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = authority,
        seeds = [TOKEN_VAULT_SEED, vault.key().as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = vault
    )]
    pub token_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init,
        payer = authority,
        seeds = [LP_MINT_SEED, vault.key().as_ref()],
        bump,
        mint::decimals = token_mint.decimals,
        mint::authority = vault
    )]
    pub lp_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

/// Shared deposit/withdraw accounts — 7 user-relevant accounts matching the
/// Meteora Dynamic Vault `deposit`/`withdraw` account order:
/// vault, token_vault, lp_mint, user_token, user_lp, user, token_program.
#[derive(Accounts)]
pub struct DepositWithdraw<'info> {
    #[account(
        mut,
        seeds = [VAULT_SEED, vault.token_mint.as_ref()],
        bump = vault.vault_bump
    )]
    pub vault: Account<'info, MockVault>,
    #[account(
        mut,
        address = vault.token_vault @ MockVaultError::WrongVaultAccount
    )]
    pub token_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        address = vault.lp_mint @ MockVaultError::WrongVaultAccount
    )]
    pub lp_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        token::mint = vault.token_mint
    )]
    pub user_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = lp_mint
    )]
    pub user_lp: InterfaceAccount<'info, TokenAccount>,
    pub user: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct Accrue<'info> {
    #[account(
        mut,
        seeds = [VAULT_SEED, vault.token_mint.as_ref()],
        bump = vault.vault_bump,
        has_one = authority @ MockVaultError::Unauthorized
    )]
    pub vault: Account<'info, MockVault>,
    #[account(
        mut,
        address = vault.token_vault @ MockVaultError::WrongVaultAccount
    )]
    pub token_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = vault.token_mint,
        token::authority = authority
    )]
    pub funder_token: InterfaceAccount<'info, TokenAccount>,
    pub authority: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    #[account(
        mut,
        seeds = [VAULT_SEED, vault.token_mint.as_ref()],
        bump = vault.vault_bump,
        has_one = authority @ MockVaultError::Unauthorized
    )]
    pub vault: Account<'info, MockVault>,
    pub authority: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct MockVault {
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub token_vault: Pubkey,
    pub lp_mint: Pubkey,
    pub total_deposited: u64,
    pub virtual_price: u64,
    pub paused: bool,
    pub vault_bump: u8,
}

#[error_code]
pub enum MockVaultError {
    #[msg("Amount must be greater than zero.")]
    ZeroAmount,
    #[msg("The slippage threshold must be greater than zero.")]
    SlippageThresholdZero,
    #[msg("Output fell below the caller's minimum (slippage exceeded).")]
    ExceededSlippage,
    #[msg("Arithmetic overflow or underflow occurred.")]
    MathOverflow,
    #[msg("The vault is paused.")]
    VaultPaused,
    #[msg("Only the vault authority may perform this action.")]
    Unauthorized,
    #[msg("The supplied token vault or LP mint does not match vault state.")]
    WrongVaultAccount,
}
