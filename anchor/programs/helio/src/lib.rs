use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

use instructions::*;
use state::AutoYieldConfigArgs;

declare_id!("Fg6PaFpoGXkYsidMpWxTWqkZqWQmBfG1N6BqUyPpQ7QZ");

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
}
