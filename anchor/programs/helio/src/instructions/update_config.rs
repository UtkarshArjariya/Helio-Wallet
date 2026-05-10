use anchor_lang::prelude::*;

use crate::constants::CONFIG_SEED;
use crate::errors::AutoYieldError;
use crate::state::{AutoYieldConfigArgs, UserAutoYieldConfig};

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

pub fn update_handler(
    ctx: Context<UpdateAutoYieldConfig>,
    args: AutoYieldConfigArgs,
) -> Result<()> {
    args.validate()?;
    ctx.accounts.config.apply_update(args);
    Ok(())
}

pub fn pause_handler(ctx: Context<UpdateAutoYieldConfig>) -> Result<()> {
    ctx.accounts.config.paused = true;
    Ok(())
}

pub fn resume_handler(ctx: Context<UpdateAutoYieldConfig>) -> Result<()> {
    ctx.accounts.config.paused = false;
    Ok(())
}
