use anchor_lang::prelude::*;

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
    #[msg("Sweep basis points must be between 10 and 200 (0.1% to 2%).")]
    InvalidSweepBps,
    #[msg("Send amount must be greater than zero.")]
    InvalidSendAmount,
}
