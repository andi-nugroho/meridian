use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
};
use byteorder::{LittleEndian, WriteBytesExt};
use std::io::{Cursor, Write};

use crate::errors::MeridianError;

// Finalized consistency = 1, instant = 200
pub const CONSISTENCY_LEVEL_FINALIZED: u8 = 1;

// Max size for calldata - 10kb should be enough for most txs
pub const MAX_CALL_DATA_SIZE: usize = 10000;

// Simple struct for Wormhole message posting
#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct PostMessageData {
    pub nonce: u32,
    pub payload: Vec<u8>,
    pub consistency_level: u8,
}

// Message types - only transaction for now
// TODO: Add more types later if needed
pub enum MeridianMessageType {
    Transaction = 1,
}

/// Posts a message through Wormhole - this is a bit complex but necessary
pub fn post_wormhole_message<'a>(
    payer: AccountInfo<'a>,
    wormhole_program: AccountInfo<'a>,
    wormhole_bridge: AccountInfo<'a>,
    wormhole_message: AccountInfo<'a>,
    emitter: AccountInfo<'a>,
    wormhole_sequence: AccountInfo<'a>,
    wormhole_fee_collector: AccountInfo<'a>,
    clock: AccountInfo<'a>,
    rent: AccountInfo<'a>,
    system_program: AccountInfo<'a>,
    nonce: u32,
    payload: Vec<u8>,
    consistency_level: u8,
    emitter_seeds: &[&[u8]],
) -> Result<()> {
    let ix = Instruction {
        program_id: wormhole_program.key(),
        accounts: vec![
            AccountMeta::new(*payer.key, true),
            AccountMeta::new(*wormhole_bridge.key, false),
            AccountMeta::new(*wormhole_message.key, true),
            AccountMeta::new(*emitter.key, false),
            AccountMeta::new(*wormhole_sequence.key, true),
            AccountMeta::new(*wormhole_fee_collector.key, true),
            AccountMeta::new_readonly(*clock.key, false),
            AccountMeta::new_readonly(*rent.key, false),
            AccountMeta::new_readonly(*system_program.key, false),
        ],
        data: PostMessageData {
            nonce,
            payload,
            consistency_level,
        }
        .try_to_vec()
        .map_err(|_| error!(MeridianError::FailedToSendMessage))?,
    };

    // Use invoke_signed with the accounts directly
    let accounts = &[
        payer,
        wormhole_bridge,
        wormhole_message,
        emitter,
        wormhole_sequence,
        wormhole_fee_collector,
        clock,
        rent,
        system_program,
    ];

    invoke_signed(&ix, accounts, &[emitter_seeds])?;

    Ok(())
}

// Builds tx payload that will be sent across the bridge
// Format:
// - proposal_key: 32 bytes
// - target_chain: 2 bytes
// - target_address: 32 bytes
// - call_data: variable
// - gas_limit: 8 bytes
// - sequence: 8 bytes
// - timestamp: 8 bytes
pub fn create_transaction_payload(
    proposal_key: Pubkey,
    target_chain: u16,
    target_address: [u8; 32],
    call_data: Vec<u8>,
    gas_limit: u64,
    sequence: u64,
    timestamp: i64,
) -> Vec<u8> {
    let mut payload = Vec::new();
    {
        let mut writer = Cursor::new(&mut payload);

        // Version (1 byte)
        writer.write_u8(1).unwrap();

        // Message type (1 byte)
        writer
            .write_u8(MeridianMessageType::Transaction as u8)
            .unwrap();

        // Sequence (8 bytes)
        writer.write_u64::<LittleEndian>(sequence).unwrap();

        // Timestamp (8 bytes)
        writer.write_i64::<LittleEndian>(timestamp).unwrap();

        // Nonce (4 bytes)
        writer.write_u32::<LittleEndian>(0).unwrap(); // Could use a random nonce

        // Proposal account key (32 bytes)
        writer.write_all(&proposal_key.to_bytes()).unwrap();

        // Target chain (2 bytes)
        writer.write_u16::<LittleEndian>(target_chain).unwrap();

        // Target address (32 bytes)
        writer.write_all(&target_address).unwrap();

        // Gas limit (8 bytes)
        writer.write_u64::<LittleEndian>(gas_limit).unwrap();

        // Call data length (4 bytes)
        writer
            .write_u32::<LittleEndian>(call_data.len() as u32)
            .unwrap();

        // Call data (variable)
        writer.write_all(&call_data).unwrap();
    }
    // Return the filled payload
    payload
}

// Checks if a squads proposal is approved
// FIXME: Implement proper Squads program integration
pub fn is_proposal_approved(
    _squads_program: &AccountInfo,
    _multisig_account: &AccountInfo,
    _proposal_account: &AccountInfo,
) -> Result<bool> {
    // Temporarily return true for testing
    // TODO: Connect to actual Squads program
    Ok(true)
}
