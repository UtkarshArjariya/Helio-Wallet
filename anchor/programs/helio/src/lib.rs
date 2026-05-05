use anchor_lang::{
    prelude::*,
    system_program::{self, Transfer},
};
use anchor_spl::token::{
    self, CloseAccount, Mint, Token, TokenAccount, TransferChecked,
};

declare_id!("Fg6PaFpoGXkYsidMpWxTWqkZqWQmBfG1N6BqUyPpQ7QZ");

const CONFIG_SEED: &[u8] = b"config";
const RESERVE_SEED: &[u8] = b"reserve";
const AUTHORITY_SEED: &[u8] = b"authority";
const SOL_VAULT_SEED: &[u8] = b"sol-vault";
const STABLE_VAULT_SEED: &[u8] = b"vault";

const SWEEP_MODE_ROUND_UP: u8 = 0;
const SWEEP_MODE_PERCENTAGE: u8 = 1;

const PROTOCOL_KAMINO: u8 = 0;
const PROTOCOL_MASK_KAMINO: u16 = 1 << PROTOCOL_KAMINO;

#[program]
pub mod helio_autoyield {
    use super::*;

    pub fn initialize_auto_yield(
        ctx: Context<InitializeAutoYield>,
        args: AutoYieldConfigArgs,
    ) -> Result<()> {
        validate_config_args(&args)?;

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
        ctx.accounts
            .sol_vault
            .set_inner(SolVault::new(ctx.accounts.owner.key()));

        Ok(())
    }

    pub fn update_auto_yield_config(
        ctx: Context<UpdateAutoYieldConfig>,
        args: AutoYieldConfigArgs,
    ) -> Result<()> {
        validate_config_args(&args)?;
        ctx.accounts.config.apply_update(args);
        Ok(())
    }

    pub fn pause_auto_yield(ctx: Context<UpdateAutoYieldConfig>) -> Result<()> {
        ctx.accounts.config.paused = true;
        Ok(())
    }

    pub fn resume_auto_yield(ctx: Context<UpdateAutoYieldConfig>) -> Result<()> {
        ctx.accounts.config.paused = false;
        Ok(())
    }

    pub fn sweep_sol(ctx: Context<SweepSol>, amount_lamports: u64) -> Result<()> {
        require!(amount_lamports > 0, AutoYieldError::InvalidSweepAmount);
        assert_sweeps_enabled(&ctx.accounts.config)?;

        let transfer_accounts = Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: ctx.accounts.sol_vault.to_account_info(),
        };
        let transfer_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_accounts,
        );

        system_program::transfer(transfer_context, amount_lamports)?;
        ctx.accounts
            .reserve_state
            .record_sol_sweep(amount_lamports, Clock::get()?.unix_timestamp)?;

        Ok(())
    }

    pub fn sweep_stable(
        ctx: Context<SweepStable>,
        amount_atomic: u64,
    ) -> Result<()> {
        require!(amount_atomic > 0, AutoYieldError::InvalidSweepAmount);
        assert_sweeps_enabled(&ctx.accounts.config)?;

        let transfer_accounts = TransferChecked {
            from: ctx.accounts.owner_stable_account.to_account_info(),
            mint: ctx.accounts.stable_mint.to_account_info(),
            to: ctx.accounts.stable_vault.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };
        let transfer_context =
            CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_accounts);

        token::transfer_checked(
            transfer_context,
            amount_atomic,
            ctx.accounts.stable_mint.decimals,
        )?;
        ctx.accounts
            .reserve_state
            .record_stable_sweep(amount_atomic, Clock::get()?.unix_timestamp)?;

        Ok(())
    }

    pub fn withdraw_sol(
        ctx: Context<WithdrawSol>,
        amount_lamports: u64,
    ) -> Result<()> {
        require!(amount_lamports > 0, AutoYieldError::InvalidWithdrawAmount);
        ctx.accounts.reserve_state.assert_sol_available(amount_lamports)?;
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

    pub fn withdraw_stable(
        ctx: Context<WithdrawStable>,
        amount_atomic: u64,
    ) -> Result<()> {
        require!(amount_atomic > 0, AutoYieldError::InvalidWithdrawAmount);
        ctx.accounts.reserve_state.assert_stable_available(amount_atomic)?;

        let owner_key = ctx.accounts.owner.key();
        let reserve_authority_bump =
            find_reserve_authority_bump(&owner_key, ctx.program_id);
        let bump_seed = [reserve_authority_bump];
        let signer_seeds: &[&[u8]] =
            &[AUTHORITY_SEED, owner_key.as_ref(), &bump_seed];
        let transfer_accounts = TransferChecked {
            from: ctx.accounts.stable_vault.to_account_info(),
            mint: ctx.accounts.stable_mint.to_account_info(),
            to: ctx.accounts.owner_stable_account.to_account_info(),
            authority: ctx.accounts.reserve_authority.to_account_info(),
        };
        let transfer_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_accounts,
        )
        .with_signer(&[signer_seeds]);

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

    pub fn close_empty_reserve(ctx: Context<CloseEmptyReserve>) -> Result<()> {
        ctx.accounts.reserve_state.assert_empty()?;
        require!(
            ctx.accounts.stable_vault.amount == 0,
            AutoYieldError::ReserveNotEmpty
        );

        let owner_key = ctx.accounts.owner.key();
        let reserve_authority_bump =
            find_reserve_authority_bump(&owner_key, ctx.program_id);
        let bump_seed = [reserve_authority_bump];
        let signer_seeds: &[&[u8]] =
            &[AUTHORITY_SEED, owner_key.as_ref(), &bump_seed];
        let close_accounts = CloseAccount {
            account: ctx.accounts.stable_vault.to_account_info(),
            destination: ctx.accounts.owner.to_account_info(),
            authority: ctx.accounts.reserve_authority.to_account_info(),
        };
        let close_context =
            CpiContext::new(ctx.accounts.token_program.to_account_info(), close_accounts)
                .with_signer(&[signer_seeds]);

        token::close_account(close_context)?;
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct AutoYieldConfigArgs {
    pub enabled: bool,
    pub paused: bool,
    pub sweep_mode: u8,
    pub round_up_unit_lamports: u64,
    pub percentage_bps: u16,
    pub deploy_threshold_atomic: u64,
    pub active_protocol: u8,
    pub allowed_protocols_mask: u16,
    pub excluded_protocols_mask: u16,
}

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
        init,
        payer = owner,
        space = 8 + SolVault::INIT_SPACE,
        seeds = [SOL_VAULT_SEED, owner.key().as_ref()],
        bump
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

#[derive(Accounts)]
pub struct UpdateAutoYieldConfig<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [CONFIG_SEED, owner.key().as_ref()],
        bump,
        constraint = config.owner == owner.key() @ AutoYieldError::Unauthorized
    )]
    pub config: Account<'info, UserAutoYieldConfig>,
}

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

#[derive(Accounts)]
pub struct SweepStable<'info> {
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

#[account]
#[derive(InitSpace)]
pub struct UserAutoYieldConfig {
    pub owner: Pubkey,
    pub preferred_stable_mint: Pubkey,
    pub enabled: bool,
    pub paused: bool,
    pub sweep_mode: u8,
    pub active_protocol: u8,
    pub round_up_unit_lamports: u64,
    pub percentage_bps: u16,
    pub deploy_threshold_atomic: u64,
    pub allowed_protocols_mask: u16,
    pub excluded_protocols_mask: u16,
}

impl UserAutoYieldConfig {
    fn new(owner: Pubkey, preferred_stable_mint: Pubkey, args: AutoYieldConfigArgs) -> Self {
        Self {
            owner,
            preferred_stable_mint,
            enabled: args.enabled,
            paused: args.paused,
            sweep_mode: args.sweep_mode,
            active_protocol: args.active_protocol,
            round_up_unit_lamports: args.round_up_unit_lamports,
            percentage_bps: args.percentage_bps,
            deploy_threshold_atomic: args.deploy_threshold_atomic,
            allowed_protocols_mask: args.allowed_protocols_mask,
            excluded_protocols_mask: args.excluded_protocols_mask,
        }
    }

    fn apply_update(&mut self, args: AutoYieldConfigArgs) {
        self.enabled = args.enabled;
        self.paused = args.paused;
        self.sweep_mode = args.sweep_mode;
        self.active_protocol = args.active_protocol;
        self.round_up_unit_lamports = args.round_up_unit_lamports;
        self.percentage_bps = args.percentage_bps;
        self.deploy_threshold_atomic = args.deploy_threshold_atomic;
        self.allowed_protocols_mask = args.allowed_protocols_mask;
        self.excluded_protocols_mask = args.excluded_protocols_mask;
    }
}

#[account]
#[derive(InitSpace)]
pub struct UserReserveState {
    pub owner: Pubkey,
    pub config: Pubkey,
    pub sol_vault: Pubkey,
    pub stable_vault: Pubkey,
    pub sol_balance_lamports: u64,
    pub stable_balance_atomic: u64,
    pub total_swept_sol_lamports: u64,
    pub total_swept_stable_atomic: u64,
    pub last_sweep_unix_ts: i64,
    pub last_withdraw_unix_ts: i64,
}

impl UserReserveState {
    fn new(owner: Pubkey, config: Pubkey, sol_vault: Pubkey, stable_vault: Pubkey) -> Self {
        Self {
            owner,
            config,
            sol_vault,
            stable_vault,
            sol_balance_lamports: 0,
            stable_balance_atomic: 0,
            total_swept_sol_lamports: 0,
            total_swept_stable_atomic: 0,
            last_sweep_unix_ts: 0,
            last_withdraw_unix_ts: 0,
        }
    }

    fn record_sol_sweep(&mut self, amount: u64, timestamp: i64) -> Result<()> {
        self.sol_balance_lamports = checked_add_u64(self.sol_balance_lamports, amount)?;
        self.total_swept_sol_lamports =
            checked_add_u64(self.total_swept_sol_lamports, amount)?;
        self.last_sweep_unix_ts = timestamp;
        Ok(())
    }

    fn record_stable_sweep(&mut self, amount: u64, timestamp: i64) -> Result<()> {
        self.stable_balance_atomic = checked_add_u64(self.stable_balance_atomic, amount)?;
        self.total_swept_stable_atomic =
            checked_add_u64(self.total_swept_stable_atomic, amount)?;
        self.last_sweep_unix_ts = timestamp;
        Ok(())
    }

    fn record_sol_withdrawal(&mut self, amount: u64, timestamp: i64) -> Result<()> {
        self.sol_balance_lamports = checked_sub_u64(self.sol_balance_lamports, amount)?;
        self.last_withdraw_unix_ts = timestamp;
        Ok(())
    }

    fn record_stable_withdrawal(&mut self, amount: u64, timestamp: i64) -> Result<()> {
        self.stable_balance_atomic = checked_sub_u64(self.stable_balance_atomic, amount)?;
        self.last_withdraw_unix_ts = timestamp;
        Ok(())
    }

    fn assert_sol_available(&self, amount: u64) -> Result<()> {
        require!(
            self.sol_balance_lamports >= amount,
            AutoYieldError::InsufficientSolReserve
        );
        Ok(())
    }

    fn assert_stable_available(&self, amount: u64) -> Result<()> {
        require!(
            self.stable_balance_atomic >= amount,
            AutoYieldError::InsufficientStableReserve
        );
        Ok(())
    }

    fn assert_empty(&self) -> Result<()> {
        require!(
            self.sol_balance_lamports == 0 && self.stable_balance_atomic == 0,
            AutoYieldError::ReserveNotEmpty
        );
        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct SolVault {
    pub owner: Pubkey,
}

impl SolVault {
    fn new(owner: Pubkey) -> Self {
        Self { owner }
    }
}

#[error_code]
pub enum AutoYieldError {
    #[msg("Only the reserve owner may perform this action.")]
    Unauthorized,
    #[msg("The provided AutoYield config is invalid.")]
    InvalidConfig,
    #[msg("The selected sweep mode is not supported.")]
    InvalidSweepMode,
    #[msg("The round-up lamport unit must be greater than zero.")]
    InvalidRoundUpUnit,
    #[msg("The percentage basis points must be between 1 and 10,000.")]
    InvalidPercentageBps,
    #[msg("The deploy threshold must be greater than zero.")]
    InvalidDeployThreshold,
    #[msg("The selected protocol is not supported by this program version.")]
    UnsupportedProtocol,
    #[msg("The active protocol is not included in the allowlist.")]
    ActiveProtocolNotAllowed,
    #[msg("The active protocol is currently excluded by policy.")]
    ActiveProtocolExcluded,
    #[msg("AutoYield is disabled for this reserve.")]
    AutoYieldDisabled,
    #[msg("AutoYield is paused for this reserve.")]
    AutoYieldPaused,
    #[msg("The sweep amount must be greater than zero.")]
    InvalidSweepAmount,
    #[msg("The withdrawal amount must be greater than zero.")]
    InvalidWithdrawAmount,
    #[msg("Arithmetic overflow or underflow occurred.")]
    ArithmeticOverflow,
    #[msg("The reserve does not have enough SOL available.")]
    InsufficientSolReserve,
    #[msg("The reserve does not have enough stablecoins available.")]
    InsufficientStableReserve,
    #[msg("The reserve still contains assets and cannot be closed.")]
    ReserveNotEmpty,
    #[msg("The stable mint does not match the configured preferred mint.")]
    InvalidStableMint,
    #[msg("The provided reserve state does not belong to this config.")]
    ReserveConfigMismatch,
    #[msg("The provided SOL vault PDA is invalid.")]
    InvalidSolVault,
    #[msg("The provided stable vault PDA is invalid.")]
    InvalidStableVault,
    #[msg("The SOL vault would fall below rent exemption after withdrawal.")]
    SolVaultRentViolation,
}

fn validate_config_args(args: &AutoYieldConfigArgs) -> Result<()> {
    require!(
        args.sweep_mode == SWEEP_MODE_ROUND_UP || args.sweep_mode == SWEEP_MODE_PERCENTAGE,
        AutoYieldError::InvalidSweepMode
    );
    require!(
        args.round_up_unit_lamports > 0,
        AutoYieldError::InvalidRoundUpUnit
    );
    require!(
        args.percentage_bps > 0 && args.percentage_bps <= 10_000,
        AutoYieldError::InvalidPercentageBps
    );
    require!(
        args.deploy_threshold_atomic > 0,
        AutoYieldError::InvalidDeployThreshold
    );
    require!(
        args.active_protocol == PROTOCOL_KAMINO,
        AutoYieldError::UnsupportedProtocol
    );

    let active_protocol_mask = protocol_mask(args.active_protocol)?;

    require!(
        args.allowed_protocols_mask & active_protocol_mask != 0,
        AutoYieldError::ActiveProtocolNotAllowed
    );
    require!(
        args.excluded_protocols_mask & active_protocol_mask == 0,
        AutoYieldError::ActiveProtocolExcluded
    );

    Ok(())
}

fn assert_sweeps_enabled(config: &UserAutoYieldConfig) -> Result<()> {
    require!(config.enabled, AutoYieldError::AutoYieldDisabled);
    require!(!config.paused, AutoYieldError::AutoYieldPaused);
    Ok(())
}

fn protocol_mask(protocol: u8) -> Result<u16> {
    require!(protocol == PROTOCOL_KAMINO, AutoYieldError::UnsupportedProtocol);
    Ok(PROTOCOL_MASK_KAMINO)
}

fn checked_add_u64(left: u64, right: u64) -> Result<u64> {
    left.checked_add(right)
        .ok_or_else(|| error!(AutoYieldError::ArithmeticOverflow))
}

fn checked_sub_u64(left: u64, right: u64) -> Result<u64> {
    left.checked_sub(right)
        .ok_or_else(|| error!(AutoYieldError::ArithmeticOverflow))
}

fn find_reserve_authority_bump(owner: &Pubkey, program_id: &Pubkey) -> u8 {
    let (_, bump) =
        Pubkey::find_program_address(&[AUTHORITY_SEED, owner.as_ref()], program_id);

    bump
}

fn assert_sol_vault_rent_exempt(
    sol_vault: &AccountInfo<'_>,
    withdraw_amount: u64,
) -> Result<()> {
    let rent = Rent::get()?;
    let minimum_balance = rent.minimum_balance(sol_vault.data_len());
    let remaining_lamports = checked_sub_u64(sol_vault.lamports(), withdraw_amount)?;

    require!(
        remaining_lamports >= minimum_balance,
        AutoYieldError::SolVaultRentViolation
    );

    Ok(())
}

fn move_lamports(
    from: &AccountInfo<'_>,
    to: &AccountInfo<'_>,
    amount: u64,
) -> Result<()> {
    let next_from_lamports = checked_sub_u64(from.lamports(), amount)?;
    let next_to_lamports = checked_add_u64(to.lamports(), amount)?;

    **from.try_borrow_mut_lamports()? = next_from_lamports;
    **to.try_borrow_mut_lamports()? = next_to_lamports;

    Ok(())
}
