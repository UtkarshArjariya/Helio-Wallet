use anchor_lang::prelude::*;
use anchor_lang::solana_program::{instruction::Instruction, program::invoke_signed};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{
    AUTHORITY_SEED, CONFIG_SEED, METEORA_VAULT_PROGRAM_ID, MOCK_VAULT_PROGRAM_ID, PROTOCOL_METEORA,
    PROTOCOL_MOCK, RESERVE_SEED, STABLE_VAULT_SEED,
};
use crate::errors::AutoYieldError;
use crate::state::{UserAutoYieldConfig, UserReserveState};

/// Anchor global-instruction discriminator for the mock vault's `deposit`
/// (`sha256("global:deposit")[..8]`). The mock vault is built with the SAME
/// Anchor 1.0.2 toolchain as helio, so this discriminator is stable.
///
/// UNVERIFIED for Meteora: Meteora's Dynamic Vault is built on Anchor 0.9.4 /
/// toolchain 0.31.1, so its on-chain `deposit` discriminator and exact account
/// order MUST be cross-checked against its IDL before any deploy that targets
/// `PROTOCOL_METEORA`. The (token_amount, minimum_lp_token_amount) arg shape and
/// the 7-account order [vault, token_vault, lp_mint, user_token, user_lp, user,
/// token_program] are confirmed from Meteora docs, but the discriminator is not.
const DEPOSIT_DISCRIMINATOR: [u8; 8] = [242, 35, 198, 137, 82, 225, 242, 182];

/// Deploy `amount_atomic` of the reserve's liquid stable principal into the
/// active yield protocol's vault, receiving LP tokens into the reserve
/// authority's LP token account.
///
/// SECURITY:
/// - External program id is pinned to the active protocol (`WrongProtocolProgram`).
/// - `token_vault` / `lp_mint` are validated to be the vault's own PDAs derived
///   from the *deserialized* vault key + protocol program id, so a malicious
///   caller cannot substitute attacker-controlled token accounts.
/// - Vault state account ownership is checked to equal the protocol program.
/// - PDA-signed CPI via `reserve_authority` (same seeds as `withdraw_stable`).
/// - LP minted is measured by `reload()` (received-not-requested) and must be
///   `>= min_lp_out` (non-zero slippage bound), else `ExceededSlippage`.
/// - Checks-effects-interactions: validate -> CPI -> measure -> record.
#[derive(Accounts)]
pub struct DeployToProtocol<'info> {
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
    /// CHECK / SAFETY: This is a program PDA, not a deserializable account, so it
    /// has no discriminator to validate. Its address is constrained by the
    /// `seeds = [AUTHORITY_SEED, owner]` PDA derivation, and it is used ONLY as
    /// the signing authority for the reserve's token accounts (same role and
    /// pattern as `withdraw_stable.rs::reserve_authority`).
    #[account(seeds = [AUTHORITY_SEED, owner.key().as_ref()], bump)]
    pub reserve_authority: UncheckedAccount<'info>,
    /// The reserve's stable vault (source of the deployed principal).
    #[account(
        mut,
        seeds = [STABLE_VAULT_SEED, owner.key().as_ref(), stable_mint.key().as_ref()],
        bump,
        token::mint = stable_mint,
        token::authority = reserve_authority
    )]
    pub stable_vault: InterfaceAccount<'info, TokenAccount>,
    /// The protocol vault state account.
    /// CHECK / SAFETY: This is foreign program state with a layout we do not own
    /// (mock vault or Meteora), so it is intentionally NOT deserialized here. The
    /// handler enforces every required invariant: `protocol_vault.owner` must
    /// equal the pinned protocol program id (`WrongVaultState`), and the supplied
    /// `protocol_token_vault` / `protocol_lp_mint` must be the PDAs derived from
    /// this vault key + program id. We never read or trust its raw bytes.
    #[account(mut)]
    pub protocol_vault: UncheckedAccount<'info>,
    /// The protocol vault's reserve token account (destination of the deposit).
    /// Validated in the handler to be the `[b"token_vault", protocol_vault]` PDA.
    #[account(mut)]
    pub protocol_token_vault: InterfaceAccount<'info, TokenAccount>,
    /// The protocol vault's LP mint. Validated in the handler to be the
    /// `[b"lp_mint", protocol_vault]` PDA.
    #[account(mut)]
    pub protocol_lp_mint: InterfaceAccount<'info, Mint>,
    /// The reserve authority's LP token account (destination of minted LP).
    #[account(
        mut,
        token::mint = protocol_lp_mint,
        token::authority = reserve_authority
    )]
    pub reserve_lp_account: InterfaceAccount<'info, TokenAccount>,
    /// CHECK / SAFETY: pinned in the handler to the active protocol's program id
    /// via `resolve_protocol_program` (`WrongProtocolProgram`). Only used as the
    /// CPI target program; never deserialized.
    pub protocol_program: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
}

/// Seeds Meteora and the mock vault both use for their per-vault token reserve
/// and LP mint PDAs (confirmed for the mock vault; matches Meteora's documented
/// `token_vault`/`lp_mint` derivation: seed + vault key).
const TOKEN_VAULT_SEED: &[u8] = b"token_vault";
const LP_MINT_SEED: &[u8] = b"lp_mint";

/// Resolve and validate the external protocol program id against the active
/// protocol selected in the user's config.
fn resolve_protocol_program(active_protocol: u8, supplied: &Pubkey) -> Result<Pubkey> {
    let expected = match active_protocol {
        PROTOCOL_MOCK => MOCK_VAULT_PROGRAM_ID,
        PROTOCOL_METEORA => METEORA_VAULT_PROGRAM_ID,
        _ => return Err(error!(AutoYieldError::UnsupportedProtocol)),
    };
    require_keys_eq!(*supplied, expected, AutoYieldError::WrongProtocolProgram);
    Ok(expected)
}

pub fn handler(ctx: Context<DeployToProtocol>, amount_atomic: u64, min_lp_out: u64) -> Result<()> {
    // --- Checks ---
    require!(amount_atomic > 0, AutoYieldError::InvalidDeployAmount);
    require!(min_lp_out > 0, AutoYieldError::SlippageThresholdZero);
    ctx.accounts.config.assert_sweeps_enabled()?;

    let active_protocol = ctx.accounts.config.active_protocol;
    let protocol_program_id =
        resolve_protocol_program(active_protocol, ctx.accounts.protocol_program.key)?;

    // The vault state account must be genuine protocol-owned state.
    require_keys_eq!(
        *ctx.accounts.protocol_vault.owner,
        protocol_program_id,
        AutoYieldError::WrongVaultState
    );

    // Validate the supplied token_vault / lp_mint are the vault's own PDAs.
    // This binds them to `protocol_vault` so they cannot be swapped for
    // attacker-controlled accounts (we never trust user-supplied keys here).
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

    // The reserve must actually hold the principal we are about to deploy.
    ctx.accounts
        .reserve_state
        .assert_protocol_deploy_allowed(amount_atomic)?;

    // Snapshot LP balance BEFORE the CPI so we can measure what was received.
    let lp_before = ctx.accounts.reserve_lp_account.amount;

    // --- Interactions: PDA-signed CPI into the protocol's `deposit` ---
    let owner_key = ctx.accounts.owner.key();
    let bump_seed = [ctx.bumps.reserve_authority];
    let signer_seeds: &[&[u8]] = &[AUTHORITY_SEED, owner_key.as_ref(), &bump_seed];

    // Borsh arg layout: (token_amount: u64, minimum_lp_token_amount: u64).
    // We pass our own `min_lp_out` to the protocol as a defense-in-depth bound;
    // we independently re-check the realized LP after `reload()` below.
    let mut data = Vec::with_capacity(8 + 8 + 8);
    data.extend_from_slice(&DEPOSIT_DISCRIMINATOR);
    data.extend_from_slice(&amount_atomic.to_le_bytes());
    data.extend_from_slice(&min_lp_out.to_le_bytes());

    // 7-account order matching Meteora's documented `deposit` and the mock
    // vault's `DepositWithdraw`:
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
    ctx.accounts.reserve_lp_account.reload()?;
    let lp_after = ctx.accounts.reserve_lp_account.amount;
    let lp_minted = lp_after
        .checked_sub(lp_before)
        .ok_or(AutoYieldError::ArithmeticOverflow)?;
    require!(lp_minted >= min_lp_out, AutoYieldError::ExceededSlippage);

    // --- Effects: record deployed principal + received LP ---
    ctx.accounts.reserve_state.record_protocol_deploy(
        amount_atomic,
        lp_minted,
        Clock::get()?.unix_timestamp,
    )?;

    Ok(())
}
