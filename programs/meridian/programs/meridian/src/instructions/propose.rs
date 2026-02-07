use crate::errors::MeridianError;
use crate::state::*;
use crate::utils::MAX_CALL_DATA_SIZE;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(transaction_index: u64, target_chain: u16, target_address: [u8; 32], call_data: Vec<u8>, gas_limit: u64)]
pub struct ProposeTransaction<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, MeridianConfig>,

    /// CHECK: Make sure it's our authorized multisig
    #[account(
        constraint = config.authorized_multisig == multisig.key() @ MeridianError::UnauthorizedMultisig
    )]
    pub multisig: UncheckedAccount<'info>,

    /// CHECK: Squads transaction we're linking to
    pub transaction: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        space = CrossChainProposal::space(call_data.len()),
        seeds = [
            b"proposal",
            multisig.key().as_ref(),
            &transaction_index.to_le_bytes(),
        ],
        bump
    )]
    pub proposal: Account<'info, CrossChainProposal>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// Creates a new cross-chain proposal
// This doesn't execute anything yet, just saves the details
pub fn handler(
    ctx: Context<ProposeTransaction>,
    transaction_index: u64,
    target_chain: u16,
    target_address: [u8; 32],
    call_data: Vec<u8>,
    gas_limit: u64,
) -> Result<()> {
    // Validate inputs
    if call_data.len() > MAX_CALL_DATA_SIZE {
        return err!(MeridianError::CallDataTooLarge);
    }

    // Create the proposal
    let proposal = &mut ctx.accounts.proposal;
    proposal.multisig = ctx.accounts.multisig.key();
    proposal.transaction_index = transaction_index;
    proposal.target_chain = target_chain;
    proposal.target_address = target_address;
    proposal.call_data = call_data;
    proposal.gas_limit = gas_limit;
    proposal.status = ProposalStatus::Pending;
    proposal.wormhole_sequence = None;
    proposal.created_at = Clock::get()?.unix_timestamp;
    proposal.executed_at = None;
    proposal.bump = ctx.bumps.proposal;

    msg!(
        "Created cross-chain proposal for transaction index: {}",
        transaction_index
    );
    msg!("Target chain: {}", target_chain);
    msg!("Call data length: {} bytes", proposal.call_data.len());

    Ok(())
}
