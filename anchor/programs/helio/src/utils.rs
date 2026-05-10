use anchor_lang::prelude::*;

use crate::constants::{AUTHORITY_SEED, PROTOCOL_KAMINO, PROTOCOL_MASK_KAMINO};
use crate::errors::AutoYieldError;

pub fn checked_add_u64(left: u64, right: u64) -> Result<u64> {
    left.checked_add(right)
        .ok_or_else(|| error!(AutoYieldError::ArithmeticOverflow))
}

pub fn checked_sub_u64(left: u64, right: u64) -> Result<u64> {
    left.checked_sub(right)
        .ok_or_else(|| error!(AutoYieldError::ArithmeticOverflow))
}

pub fn protocol_mask(protocol: u8) -> Result<u16> {
    require!(protocol == PROTOCOL_KAMINO, AutoYieldError::UnsupportedProtocol);
    Ok(PROTOCOL_MASK_KAMINO)
}

pub fn find_reserve_authority_bump(owner: &Pubkey, program_id: &Pubkey) -> u8 {
    let (_, bump) =
        Pubkey::find_program_address(&[AUTHORITY_SEED, owner.as_ref()], program_id);
    bump
}

pub fn assert_sol_vault_rent_exempt(
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

pub fn move_lamports(
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
