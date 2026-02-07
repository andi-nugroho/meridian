use crate::errors::MeridianError;
use crate::state::*;
use crate::utils::{
    create_transaction_payload, is_proposal_approved, post_wormhole_message,
    CONSISTENCY_LEVEL_FINALIZED,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, MeridianConfig>,

    #[account(
        mut,
        seeds = [
            b"proposal",
            proposal.multisig.as_ref(),
            &proposal.transaction_index.to_le_bytes(),
        ],
        bump = proposal.bump,
        constraint = proposal.status == ProposalStatus::Pending @ MeridianError::ProposalNotPending
    )]
    pub proposal: Account<'info, CrossChainProposal>,

    /// CHECK: Squads multisig that owns this proposal
    #[account(
        constraint = config.authorized_multisig == multisig.key() @ MeridianError::UnauthorizedMultisig,
        constraint = proposal.multisig == multisig.key()
    )]
    pub multisig: UncheckedAccount<'info>,

    /// CHECK: Linked Squads proposal
    pub squads_proposal: UncheckedAccount<'info>,

    /// CHECK: Wormhole program - don't change this!
    #[account(
        constraint = config.wormhole_program == wormhole_program.key() @ MeridianError::InvalidWormholeProgram
    )]
    pub wormhole_program: UncheckedAccount<'info>,

    /// CHECK: Bridge PDA from Wormhole
    #[account(
        constraint = config.wormhole_bridge == wormhole_bridge.key()
    )]
    pub wormhole_bridge: UncheckedAccount<'info>,

    /// CHECK: Will be created during execution
    #[account(mut)]
    pub wormhole_message: UncheckedAccount<'info>,

    /// CHECK: Tracks message sequence
    #[account(mut)]
    pub wormhole_sequence: UncheckedAccount<'info>,

    /// CHECK: Where fees go
    #[account(
        mut,
        constraint = config.wormhole_fee_collector == wormhole_fee_collector.key()
    )]
    pub wormhole_fee_collector: UncheckedAccount<'info>,

    /// CHECK: Our emitter PDA
    #[account(
        seeds = [b"emitter"],
        bump = config.emitter_bump,
        constraint = config.emitter == emitter.key()
    )]
    pub emitter: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
    pub rent: Sysvar<'info, Rent>,
}

// Main handler for executing a proposal
// This is where the cross-chain magic happens!
pub fn handler(ctx: Context<ExecuteProposal>) -> Result<()> {
    // Verify the proposal is approved by the Squads multisig
    // This would typically be a CPI to Squads to check the proposal status
    let is_approved = is_proposal_approved(
        &ctx.accounts.wormhole_program, // Will actually be squads_program in real implementation
        &ctx.accounts.multisig,
        &ctx.accounts.squads_proposal,
    )?;

    if !is_approved {
        return err!(MeridianError::ProposalNotApproved);
    }

    let config = &mut ctx.accounts.config;
    let proposal = &mut ctx.accounts.proposal;
    let clock = Clock::get()?;

    // Increment sequence for this message
    config.sequence += 1;

    // Create transaction payload for Wormhole
    let payload = create_transaction_payload(
        proposal.key(),
        proposal.target_chain,
        proposal.target_address,
        proposal.call_data.clone(),
        proposal.gas_limit,
        config.sequence,
        clock.unix_timestamp,
    );

    // Prepare seeds for the emitter PDA
    let emitter_seeds: &[&[u8]] = &[b"emitter", &[config.emitter_bump]];

    // Post the message to Wormhole
    post_wormhole_message(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.wormhole_program.to_account_info(),
        ctx.accounts.wormhole_bridge.to_account_info(),
        ctx.accounts.wormhole_message.to_account_info(),
        ctx.accounts.emitter.to_account_info(),
        ctx.accounts.wormhole_sequence.to_account_info(),
        ctx.accounts.wormhole_fee_collector.to_account_info(),
        ctx.accounts.clock.to_account_info(),
        ctx.accounts.rent.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
        0, // nonce
        payload,
        CONSISTENCY_LEVEL_FINALIZED,
        emitter_seeds,
    )?;

    // Update proposal status
    proposal.status = ProposalStatus::Executed;
    proposal.wormhole_sequence = Some(config.sequence);
    proposal.executed_at = Some(clock.unix_timestamp);

    msg!(
        "Executed proposal with transaction index: {}",
        proposal.transaction_index
    );
    msg!("Wormhole sequence: {}", config.sequence);

    Ok(())
}
