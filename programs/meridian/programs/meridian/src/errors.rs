use anchor_lang::prelude::*;

#[error_code]
pub enum MeridianError {
    #[msg("The multisig is not authorized to use this program")]
    UnauthorizedMultisig,
    
    #[msg("The proposal is not in a pending state")]
    ProposalNotPending,
    
    #[msg("The proposal has not been approved by the multisig")]
    ProposalNotApproved,
    
    #[msg("Invalid Wormhole program ID")]
    InvalidWormholeProgram,
    
    #[msg("Failed to send Wormhole message")]
    FailedToSendMessage,
    
    #[msg("The transaction index does not match")]
    TransactionIndexMismatch,
    
    #[msg("Invalid target chain ID")]
    InvalidTargetChain,
    
    #[msg("Proposal already executed")]
    ProposalAlreadyExecuted,
    
    #[msg("Unauthorized authority")]
    UnauthorizedAuthority,
    
    #[msg("Invalid target address format")]
    InvalidTargetAddress,
    
    #[msg("Call data exceeds maximum size")]
    CallDataTooLarge,
    
    #[msg("Gas limit too high")]
    GasLimitTooHigh,
}