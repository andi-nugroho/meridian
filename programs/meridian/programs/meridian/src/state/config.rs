use anchor_lang::prelude::*;

/// The global configuration account for the Meridian program
#[account]
pub struct MeridianConfig {
    /// The authority that can update program settings
    pub authority: Pubkey,
    
    /// The authorized Squads multisig PDA
    pub authorized_multisig: Pubkey,
    
    /// The Wormhole program ID
    pub wormhole_program: Pubkey,
    
    /// The Wormhole bridge PDA
    pub wormhole_bridge: Pubkey,
    
    /// The Wormhole fee collector
    pub wormhole_fee_collector: Pubkey,
    
    /// The PDA that acts as the emitter for Wormhole messages
    pub emitter: Pubkey,
    
    /// Bump seed for the emitter PDA
    pub emitter_bump: u8,
    
    /// Current sequence number for Wormhole messages
    pub sequence: u64,
    
    /// Bump seed for the config PDA
    pub bump: u8,
}

impl MeridianConfig {
    pub const SIZE: usize = 8 + // discriminator
        32 + // authority
        32 + // authorized_multisig
        32 + // wormhole_program
        32 + // wormhole_bridge
        32 + // wormhole_fee_collector
        32 + // emitter
        1 +  // emitter_bump
        8 +  // sequence
        1;   // bump
}