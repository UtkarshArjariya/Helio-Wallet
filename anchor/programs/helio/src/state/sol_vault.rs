use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct SolVault {
    pub owner: Pubkey,
}

impl SolVault {
    pub fn new(owner: Pubkey) -> Self {
        Self { owner }
    }
}
