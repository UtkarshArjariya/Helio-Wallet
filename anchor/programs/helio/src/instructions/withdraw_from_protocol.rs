use anchor_lang::prelude::*;
use anchor_lang::solana_program::{instruction::Instruction, program::invoke_signed};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{
    AUTHORITY_SEED, CONFIG_SEED, METEORA_VAULT_PROGRAM_ID, MOCK_VAULT_PROGRAM_ID, PROTOCOL_METEORA,
    PROTOCOL_MOCK, RESERVE_SEED, STABLE_VAULT_SEED,
};
use crate::errors::AutoYieldError;
use crate::state::{UserAutoYieldConfig, UserReserveState};

/// Anchor global-instruction discriminator for the mock vault's `withdraw`
/// (`sha256("global:withdraw")[..8]`). Stable for the mock vault (same Anchor
/// 1.0.2 toolchain as helio).
///
/// UNVERIFIED for Meteora: its `withdraw` discriminator and the reserve-vs-
/// strategy account variants MUST be cross-checked against its IDL before any
/// deploy targeting `PROTOCOL_METEORA`. We model only the reserve-sufficient
/// `withdraw` path (7 accounts, args (unmint_amount, min_out_amount)); the
/// `withdraw_directly_from_strategy` path is NOT implemented here.
const WITHDRAW_DISCRIMINATOR: [u8; 8] = [183, 18, 70, 156, 148, 109, 161, 34];

/// Withdraw `lp_amount` LP from the active protocol's vault back into the
/// reserve's stable vault. Symmetric to `deploy_to_protocol`.
///
/// SECURITY: identical posture to deploy — pinned program id, PDA-validated
/// token_vault/lp_mint, vault-state ownership check, PDA-signed CPI, and the
/// realized underlying out is measured via `reload()` and must be `>= min_out`.
#[derive(Accounts)]
pub struct WithdrawFromProtocol<'info> {
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
    pub stable_mint: InterfaceAccount<'info, Mint>,
    /// CHECK / SAFETY: program PDA (no discriminator); address constrained by the
    /// `seeds = [AUTHORITY_SEED, owner]` derivation and used only as the token
    /// authority / CPI signer (same as `withdraw_stable.rs::reserve_authority`).
    #[account(seeds = [AUTHORITY_SEED, owner.key().as_ref()], bump)]
    pub reserve_authority: UncheckedAccount<'info>,
    /// The reserve's stable vault (destination of the withdrawn underlying).
    #[account(
        mut,
        seeds = [STABLE_VAULT_SEED, owner.key().as_ref(), stable_mint.key().as_ref()],
        bump,
        token::mint = stable_mint,
        token::authority = reserve_authority
    )]
    pub stable_vault: InterfaceAccount<'info, TokenAccount>,
    /// CHECK / SAFETY: foreign program state, intentionally not deserialized. The
    /// handler enforces `protocol_vault.owner == pinned protocol program` and
    /// binds `protocol_token_vault` / `protocol_lp_mint` to its derived PDAs.
    #[account(mut)]
    pub protocol_vault: UncheckedAccount<'info>,
    /// Validated in the handler to be the `[b"token_vault", protocol_vault]` PDA.
    #[account(mut)]
    pub protocol_token_vault: InterfaceAccount<'info, TokenAccount>,
    /// Validated in the handler to be the `[b"lp_mint", protocol_vault]` PDA.
    #[account(mut)]
    pub protocol_lp_mint: InterfaceAccount<'info, Mint>,
    /// The reserve authority's LP token account (source of the LP to burn).
    #[account(
        mut,
        token::mint = protocol_lp_mint,
        token::authority = reserve_authority
    )]
    pub reserve_lp_account: InterfaceAccount<'info, TokenAccount>,
    /// CHECK / SAFETY: pinned in the handler to the active protocol's program id
    /// via `resolve_protocol_program`; only used as the CPI target program.
    pub protocol_program: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
}

const TOKEN_VAULT_SEED: &[u8] = b"token_vault";
const LP_MINT_SEED: &[u8] = b"lp_mint";

fn resolve_protocol_program(active_protocol: u8, supplied: &Pubkey) -> Result<Pubkey> {
    let expected = match active_protocol {
        PROTOCOL_MOCK => MOCK_VAULT_PROGRAM_ID,
        PROTOCOL_METEORA => METEORA_VAULT_PROGRAM_ID,
        _ => return Err(error!(AutoYieldError::UnsupportedProtocol)),
    };
    require_keys_eq!(*supplied, expected, AutoYieldError::WrongProtocolProgram);
    Ok(expected)
}

pub fn handler(ctx: Context<WithdrawFromProtocol>, lp_amount: u64, min_out: u64) -> Result<()> {
    // --- Checks ---
    require!(lp_amount > 0, AutoYieldError::InvalidWithdrawAmount);
    require!(min_out > 0, AutoYieldError::SlippageThresholdZero);
    ctx.accounts.config.assert_sweeps_enabled()?;

    let active_protocol = ctx.accounts.config.active_protocol;
    let protocol_program_id =
        resolve_protocol_program(active_protocol, ctx.accounts.protocol_program.key)?;

    require_keys_eq!(
        *ctx.accounts.protocol_vault.owner,
        protocol_program_id,
        AutoYieldError::WrongVaultState
    );

    let vault_key = ctx.accounts.protocol_vault.key();
    let (expected_token_vault, _) =
        Pubkey::find_program_address(&[TOKEN_VAULT_SEED, vault_key.as_ref()], &protocol_program_id);
    let (expected_lp_mint, _) =
        Pubkey::find_program_address(&[LP_MINT_SEED, vault_key.as_ref()], &protocol_program_id);
    require_keys_eq!(
        ctx.accounts.protocol_token_vault.key(),
        expected_token_vault,
        AutoYieldError::WrongVaultState
    );
    require_keys_eq!(
        ctx.accounts.protocol_lp_mint.key(),
        expected_lp_mint,
        AutoYieldError::WrongVaultState
    );

    // The reserve must hold at least the LP it is trying to redeem.
    require!(
        ctx.accounts.reserve_state.lp_balance >= lp_amount,
        AutoYieldError::ExceededSlippage
    );

    // Snapshot stable balance BEFORE the CPI to measure underlying received.
    let stable_before = ctx.accounts.stable_vault.amount;

    // --- Interactions: PDA-signed CPI into the protocol's `withdraw` ---
    let owner_key = ctx.accounts.owner.key();
    let bump_seed = [ctx.bumps.reserve_authority];
    let signer_seeds: &[&[u8]] = &[AUTHORITY_SEED, owner_key.as_ref(), &bump_seed];

    // Borsh arg layout: (unmint_amount: u64, min_out_amount: u64).
    let mut data = Vec::with_capacity(8 + 8 + 8);
    data.extend_from_slice(&WITHDRAW_DISCRIMINATOR);
    data.extend_from_slice(&lp_amount.to_le_bytes());
    data.extend_from_slice(&min_out.to_le_bytes());

    // Same 7-account order as deposit (Meteora reserve-sufficient `withdraw`
    // and the mock vault `DepositWithdraw`):
    // [vault, token_vault, lp_mint, user_token, user_lp, user(authority), token_program]
    let account_metas = vec![
        AccountMeta::new(vault_key, false),
        AccountMeta::new(ctx.accounts.protocol_token_vault.key(), false),
        AccountMeta::new(ctx.accounts.protocol_lp_mint.key(), false),
        AccountMeta::new(ctx.accounts.stable_vault.key(), false),
        AccountMeta::new(ctx.accounts.reserve_lp_account.key(), false),
        AccountMeta::new_readonly(ctx.accounts.reserve_authority.key(), true),
        AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
    ];
    let ix = Instruction {
        program_id: protocol_program_id,
        accounts: account_metas,
        data,
    };
    invoke_signed(
        &ix,
        &[
            ctx.accounts.protocol_vault.to_account_info(),
            ctx.accounts.protocol_token_vault.to_account_info(),
            ctx.accounts.protocol_lp_mint.to_account_info(),
            ctx.accounts.stable_vault.to_account_info(),
            ctx.accounts.reserve_lp_account.to_account_info(),
            ctx.accounts.reserve_authority.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ],
        &[signer_seeds],
    )?;

    // --- Measure received-not-requested ---
    ctx.accounts.stable_vault.reload()?;
    let stable_after = ctx.accounts.stable_vault.amount;
    let received = stable_after
        .checked_sub(stable_before)
        .ok_or(AutoYieldError::ArithmeticOverflow)?;
    require!(received >= min_out, AutoYieldError::ExceededSlippage);

    // --- Effects: burn LP from accounting + credit liquid stable ---
    ctx.accounts.reserve_state.record_protocol_withdraw(
        lp_amount,
        received,
        Clock::get()?.unix_timestamp,
    )?;

    Ok(())
}
