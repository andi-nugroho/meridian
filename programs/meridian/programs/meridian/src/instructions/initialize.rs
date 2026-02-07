use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = MeridianConfig::SIZE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, MeridianConfig>,

    /// The authorized Squads multisig PDA
    /// CHECK: This is the multisig that will be authorized to use Meridian
    pub authorized_multisig: UncheckedAccount<'info>,

    /// The Wormhole program
    /// CHECK: Validated in the instruction
    pub wormhole_program: UncheckedAccount<'info>,

    /// The Wormhole bridge
    /// CHECK: Will be validated later when used
    pub wormhole_bridge: UncheckedAccount<'info>,

    /// The Wormhole fee collector
    /// CHECK: Will be validated later when used
    pub wormhole_fee_collector: UncheckedAccount<'info>,

    /// The emitter PDA for sending Wormhole messages
    /// CHECK: This is a PDA of the Meridian program
    #[account(
        seeds = [b"emitter"],
        bump
    )]
    pub emitter: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    let config = &mut ctx.accounts.config;

    // Set the configuration values
    config.authority = ctx.accounts.authority.key();
    config.authorized_multisig = ctx.accounts.authorized_multisig.key();
    config.wormhole_program = ctx.accounts.wormhole_program.key();
    config.wormhole_bridge = ctx.accounts.wormhole_bridge.key();
    config.wormhole_fee_collector = ctx.accounts.wormhole_fee_collector.key();
    config.emitter = ctx.accounts.emitter.key();
    config.emitter_bump = ctx.bumps.emitter;
    config.sequence = 0;
    config.bump = ctx.bumps.config;

    msg!("Meridian initialized with authority: {}", config.authority);
    msg!("Authorized multisig: {}", config.authorized_multisig);
    msg!("Wormhole program: {}", config.wormhole_program);
    msg!("Emitter: {}", config.emitter);

    Ok(())
}
