use anchor_lang::prelude::*;

use crate::constants::{PROTOCOL_KAMINO, SWEEP_MODE_PERCENTAGE, SWEEP_MODE_ROUND_UP};
use crate::errors::AutoYieldError;
use crate::utils::protocol_mask;

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

impl AutoYieldConfigArgs {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.sweep_mode == SWEEP_MODE_ROUND_UP || self.sweep_mode == SWEEP_MODE_PERCENTAGE,
            AutoYieldError::InvalidSweepMode
        );
        require!(
            self.round_up_unit_lamports > 0,
            AutoYieldError::InvalidRoundUpUnit
        );
        require!(
            self.percentage_bps > 0 && self.percentage_bps <= 10_000,
            AutoYieldError::InvalidPercentageBps
        );
        require!(
            self.deploy_threshold_atomic > 0,
            AutoYieldError::InvalidDeployThreshold
        );
        require!(
            self.active_protocol == PROTOCOL_KAMINO,
            AutoYieldError::UnsupportedProtocol
        );

        let active_protocol_mask = protocol_mask(self.active_protocol)?;
        require!(
            self.allowed_protocols_mask & active_protocol_mask != 0,
            AutoYieldError::ActiveProtocolNotAllowed
        );
        require!(
            self.excluded_protocols_mask & active_protocol_mask == 0,
            AutoYieldError::ActiveProtocolExcluded
        );

        Ok(())
    }
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
    pub fn new(
        owner: Pubkey,
        preferred_stable_mint: Pubkey,
        args: AutoYieldConfigArgs,
    ) -> Self {
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

    pub fn apply_update(&mut self, args: AutoYieldConfigArgs) {
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

    pub fn assert_sweeps_enabled(&self) -> Result<()> {
        require!(self.enabled, AutoYieldError::AutoYieldDisabled);
        require!(!self.paused, AutoYieldError::AutoYieldPaused);
        Ok(())
    }
}
