// Anchor's macro-generated __client_accounts_* modules mean every instruction
// module re-exports the same `handler` symbol via glob — suppress the lint that
// Rust 1.95+ raises for this pattern (required for #[program] macro expansion).
#![allow(ambiguous_glob_reexports)]
// Anchor itself uses cfg flags (anchor-debug, custom-heap, custom-panic) that
// the stable toolchain doesn't recognise; suppress those warnings too.
#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

use instructions::*;
use state::AutoYieldConfigArgs;

declare_id!("Bc5g2hU4NDah3yqvA1zxTeNJkU7zN7NLx7VFhpquNg1u");

#[program]
pub mod helio {
    use super::*;

    pub fn initialize_auto_yield(
        ctx: Context<InitializeAutoYield>,
        args: AutoYieldConfigArgs,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, args)
    }

    pub fn update_auto_yield_config(
        ctx: Context<UpdateAutoYieldConfig>,
        args: AutoYieldConfigArgs,
    ) -> Result<()> {
        instructions::update_config::update_handler(ctx, args)
    }

    pub fn pause_auto_yield(ctx: Context<UpdateAutoYieldConfig>) -> Result<()> {
        instructions::update_config::pause_handler(ctx)
    }

    pub fn resume_auto_yield(ctx: Context<UpdateAutoYieldConfig>) -> Result<()> {
        instructions::update_config::resume_handler(ctx)
    }

    pub fn sweep_sol(ctx: Context<SweepSol>, amount_lamports: u64) -> Result<()> {
        instructions::sweep_sol::handler(ctx, amount_lamports)
    }

    pub fn sweep_stable(ctx: Context<SweepStable>, amount_atomic: u64) -> Result<()> {
        instructions::sweep_stable::handler(ctx, amount_atomic)
    }

    pub fn withdraw_sol(ctx: Context<WithdrawSol>, amount_lamports: u64) -> Result<()> {
        instructions::withdraw_sol::handler(ctx, amount_lamports)
    }

    pub fn withdraw_stable(ctx: Context<WithdrawStable>, amount_atomic: u64) -> Result<()> {
        instructions::withdraw_stable::handler(ctx, amount_atomic)
    }

    pub fn close_empty_reserve(ctx: Context<CloseEmptyReserve>) -> Result<()> {
        instructions::close_reserve::handler(ctx)
    }

    /// Bundle a SOL transfer + vault sweep in one transaction.
    /// Creates the vault on first call — sender pays rent.
    pub fn send_sol(
        ctx: Context<SendSol>,
        amount_lamports: u64,
        sweep_bps: u16,
    ) -> Result<()> {
        instructions::send_sol::handler(ctx, amount_lamports, sweep_bps)
    }

    /// Withdraw SOL from the personal vault without needing AutoYield config.
    pub fn withdraw_vault_sol(
        ctx: Context<WithdrawVaultSol>,
        amount_lamports: u64,
    ) -> Result<()> {
        instructions::withdraw_vault_sol::handler(ctx, amount_lamports)
    }
}
