use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

// Re-export all items from instructions so that procedural macros can resolve the generated account structs
pub use instructions::execute::*;
pub use instructions::initialize::*;
pub use instructions::propose::*;

// Import the required types
use instructions::execute::ExecuteProposal;
use instructions::initialize::Initialize;
use instructions::propose::ProposeTransaction;

declare_id!("G6sHax1H3nXc5gu8YzPmgntbQR5e1CWMqYg1ekZmjDTd");

#[program]
pub mod meridian {
    use super::*;

    /// Initialize the Meridian program with a Squads multisig as authority
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::handler(ctx)
    }

    /// Propose a cross-chain transaction to be executed on an EVM chain
    pub fn propose_transaction(
        ctx: Context<ProposeTransaction>,
        transaction_index: u64,
        target_chain: u16,
        target_address: [u8; 32],
        call_data: Vec<u8>,
        gas_limit: u64,
    ) -> Result<()> {
        instructions::propose::handler(
            ctx,
            transaction_index,
            target_chain,
            target_address,
            call_data,
            gas_limit,
        )
    }

    /// Execute an approved proposal by sending a Wormhole message
    pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        instructions::execute::handler(ctx)
    }
}
