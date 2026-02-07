use anchor_lang::prelude::*;

/// Status of a cross-chain proposal
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ProposalStatus {
    // Waiting for the multisig folks to approve
    Pending,

    // We did it! Message sent successfully
    Executed,

    // Something went wrong...check logs
    Failed,

    // Someone explicitly cancelled it
    Cancelled,
}

/// Represents a cross-chain transaction proposal
#[account]
pub struct CrossChainProposal {
    /// The Squads multisig PDA this proposal belongs to
    pub multisig: Pubkey,

    /// The Squads transaction index for verification
    pub transaction_index: u64,

    /// Target chain ID (Wormhole chain ID format)
    pub target_chain: u16,

    /// Target contract address on destination chain (32-byte format)
    pub target_address: [u8; 32],

    /// Serialized function call data
    pub call_data: Vec<u8>,

    /// Gas limit for execution
    pub gas_limit: u64,

    /// Status of this proposal
    pub status: ProposalStatus,

    /// Wormhole sequence number (if sent)
    pub wormhole_sequence: Option<u64>,

    /// Timestamp when created
    pub created_at: i64,

    /// Timestamp when executed
    pub executed_at: Option<i64>,

    /// Bump seed for the proposal PDA
    pub bump: u8,
}

impl CrossChainProposal {
    pub fn space(call_data_len: usize) -> usize {
        8 + // discriminator
        32 + // multisig
        8 +  // transaction_index
        2 +  // target_chain
        32 + // target_address
        4 + call_data_len + // call_data (Vec<u8>)
        8 +  // gas_limit
        1 +  // status
        9 +  // wormhole_sequence (Option<u64>)
        8 +  // created_at
        9 +  // executed_at (Option<i64>)
        1 // bump
    }
}
