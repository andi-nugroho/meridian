import { BN } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  SendOptions,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import { MeridianIDL } from "./types/meridian-idl";
import * as bs58 from "bs58";

// Wormhole Chain IDs
export enum WormholeChainId {
  SOLANA = 1,
  ETHEREUM = 2,
  BSC = 4,
  POLYGON = 5,
  AVALANCHE = 6,
  ARBITRUM = 23,
  OPTIMISM = 24,
  BASE = 30,
}

export type ProposalStatus = "Pending" | "Executed" | "Failed" | "Cancelled";

export interface CrossChainProposal {
  multisig: PublicKey;
  transactionIndex: BN;
  targetChain: number;
  targetAddress: number[];
  callData: Buffer;
  gasLimit: BN;
  status: ProposalStatus;
  wormholeSequence: BN | null;
  createdAt: BN;
  executedAt: BN | null;
  bump: number;
}

export interface MeridianConfig {
  authority: PublicKey;
  authorizedMultisig: PublicKey;
  wormholeProgram: PublicKey;
  wormholeBridge: PublicKey;
  wormholeFeeCollector: PublicKey;
  emitter: PublicKey;
  emitterBump: number;
  sequence: BN;
  bump: number;
}

export class MeridianClient {
  private programId: PublicKey;

  constructor(
    public connection: Connection,
    public wallet: any, // AnchorWallet
    programId?: string
  ) {
    // Store programId for later use
    this.programId = programId
      ? new PublicKey(programId)
      : new PublicKey("G6sHax1H3nXc5gu8YzPmgntbQR5e1CWMqYg1ekZmjDTd");
  }

  /**
   * Initialize the Meridian program
   * @param authorizedMultisig - The Squads multisig PDA authorized to use Meridian
   * @param wormholeProgram - The Wormhole program ID
   * @param wormholeBridge - The Wormhole bridge account
   * @param wormholeFeeCollector - The Wormhole fee collector account
   * @returns Transaction signature
   */
  async initialize(
    authorizedMultisig: PublicKey,
    wormholeProgram: PublicKey,
    wormholeBridge: PublicKey,
    wormholeFeeCollector: PublicKey
  ): Promise<string> {
    // Derive PDAs
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      this.programId
    );

    const [emitterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("emitter")],
      this.programId
    );

    try {
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();

      // Create transaction
      const transaction = new Transaction({
        feePayer: this.wallet.publicKey,
        recentBlockhash: blockhash,
      });

      // Add instruction with the correct discriminator from the IDL
      transaction.add({
        programId: this.programId,
        keys: [
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPda, isSigner: false, isWritable: true },
          { pubkey: authorizedMultisig, isSigner: false, isWritable: false },
          { pubkey: wormholeProgram, isSigner: false, isWritable: false },
          { pubkey: wormholeBridge, isSigner: false, isWritable: false },
          { pubkey: wormholeFeeCollector, isSigner: false, isWritable: false },
          { pubkey: emitterPda, isSigner: false, isWritable: false },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        data: Buffer.from([
          // Instruction discriminator (8 bytes) from the IDL for initialize
          175, 175, 109, 31, 13, 152, 155, 237,
        ]),
      });

      // Sign and send transaction
      const signature = await this.wallet.signAndSendTransaction(transaction);
      await this.connection.confirmTransaction(signature);

      return signature;
    } catch (error) {
      console.error("Error initializing Meridian:", error);
      throw error;
    }
  }

  /**
   * Propose a cross-chain transaction
   * @param multisig - The Squads multisig PDA
   * @param transactionPda - The Squads transaction PDA
   * @param transactionIndex - The Squads transaction index
   * @param targetChain - The target chain ID (Wormhole format)
   * @param targetAddress - The target contract address (32 bytes)
   * @param callData - The call data to execute on the target chain
   * @param gasLimit - Gas limit for the transaction
   * @returns Transaction signature
   */
  async proposeTransaction(
    multisig: PublicKey,
    transactionPda: PublicKey,
    transactionIndex: number | BN,
    targetChain: number,
    targetAddress: string | Uint8Array,
    callData: Buffer | Uint8Array,
    gasLimit: number | BN
  ): Promise<string> {
    // Convert target address to bytes if it's a hex string
    let targetAddressBytes: number[];

    if (typeof targetAddress === "string") {
      // Remove 0x prefix if present
      let addressHex = targetAddress.startsWith("0x")
        ? targetAddress.slice(2)
        : targetAddress;

      // Pad to 64 characters (32 bytes)
      while (addressHex.length < 64) {
        addressHex = "0" + addressHex;
      }

      // Convert to byte array
      targetAddressBytes = new Array(32);
      for (let i = 0; i < 32; i++) {
        targetAddressBytes[i] = parseInt(
          addressHex.substring(i * 2, i * 2 + 2),
          16
        );
      }
    } else {
      // Convert Uint8Array to number[]
      targetAddressBytes = Array.from(targetAddress);
    }

    // Ensure target address is 32 bytes
    if (targetAddressBytes.length !== 32) {
      throw new Error("Target address must be 32 bytes");
    }

    // Convert transaction index to BN if it's a number
    const txIndex =
      transactionIndex instanceof BN
        ? transactionIndex
        : new BN(transactionIndex);

    // Convert gas limit to BN if it's a number
    const gas = gasLimit instanceof BN ? gasLimit : new BN(gasLimit);

    // Derive config PDA
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      this.programId
    );

    // Derive proposal PDA
    const [proposalPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("proposal"),
        multisig.toBuffer(),
        new BN(txIndex).toArrayLike(Buffer, "le", 8),
      ],
      this.programId
    );

    try {
      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } =
        await this.connection.getLatestBlockhash();

      // Create transaction
      const transaction = new Transaction({
        feePayer: this.wallet.publicKey,
        recentBlockhash: blockhash,
      });

      // Prepare the instruction data
      const instructionData = Buffer.concat([
        // Instruction discriminator (8 bytes) from the IDL for propose_transaction
        Buffer.from([35, 204, 169, 240, 74, 70, 31, 236]),
        // Transaction index (8 bytes)
        txIndex.toArrayLike(Buffer, "le", 8),
        // Target chain (2 bytes)
        Buffer.from([targetChain & 0xff, (targetChain >> 8) & 0xff]),
        // Target address (32 bytes)
        Buffer.from(targetAddressBytes),
        // Call data length (4 bytes)
        Buffer.from([
          callData.length & 0xff,
          (callData.length >> 8) & 0xff,
          (callData.length >> 16) & 0xff,
          (callData.length >> 24) & 0xff,
        ]),
        // Call data (variable length)
        Buffer.from(callData),
        // Gas limit (8 bytes)
        gas.toArrayLike(Buffer, "le", 8),
      ]);

      // Add instruction
      transaction.add({
        programId: this.programId,
        keys: [
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPda, isSigner: false, isWritable: false },
          { pubkey: multisig, isSigner: false, isWritable: false },
          { pubkey: transactionPda, isSigner: false, isWritable: false },
          { pubkey: proposalPda, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        data: instructionData,
      });

      console.log("Sending transaction to propose cross-chain transaction");

      // Sign and send transaction
      const signature = await this.wallet.signAndSendTransaction(transaction);

      // Wait for confirmation
      await this.connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature,
      });

      return signature;
    } catch (error) {
      console.error("Error proposing transaction:", error);
      throw error;
    }
  }

  /**
   * Execute an approved proposal
   * @param multisig - The Squads multisig PDA
   * @param squadsProposal - The Squads proposal PDA
   * @param transactionIndex - The transaction index
   * @returns Transaction signature
   */
  async executeProposal(
    multisig: PublicKey,
    squadsProposal: PublicKey,
    transactionIndex: number | BN
  ): Promise<string> {
    // Convert transaction index to BN if it's a number
    const txIndex =
      transactionIndex instanceof BN
        ? transactionIndex
        : new BN(transactionIndex);

    // Derive config PDA
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      this.programId
    );

    // Get config to get required accounts
    const config = await this.getConfig();
    if (!config) {
      throw new Error("Config not found. Has Meridian been initialized?");
    }

    // Derive proposal PDA
    const [proposalPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("proposal"),
        multisig.toBuffer(),
        txIndex.toArrayLike(Buffer, "le", 8),
      ],
      this.programId
    );

    // Get Wormhole accounts
    const wormholeMessageAccount = Keypair.generate();

    // Derive Wormhole sequence account
    const wormholeSequenceAccount = await this.deriveWormholeSequenceAccount(
      config.emitter
    );

    // Derive the signature PDA that Wormhole needs - using wormholeMessageAccount in seed
    const [signatureAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("signature"), wormholeMessageAccount.publicKey.toBuffer()],
      this.programId
    );

    // Create and send transaction
    try {
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();

      // Create transaction
      const transaction = new Transaction({
        feePayer: this.wallet.publicKey,
        recentBlockhash: blockhash,
      });

      // Special account that's expected instead of the System Program
      const specialSystemAccount = new PublicKey(
        "3nJpgWZo86qVsvDxugFtRWVdnML4PctYe2jUHbWvXRwY"
      );

      // Create a custom instruction with exact AccountMeta objects
      const accountMetas = [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: proposalPda, isSigner: false, isWritable: true },
        { pubkey: multisig, isSigner: false, isWritable: false },
        { pubkey: squadsProposal, isSigner: false, isWritable: false },
        {
          pubkey: config.wormholeProgram,
          isSigner: false,
          isWritable: false,
        },
        { pubkey: config.wormholeBridge, isSigner: false, isWritable: true },
        {
          pubkey: signatureAccount,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: wormholeMessageAccount.publicKey,
          isSigner: true,
          isWritable: true,
        },
        {
          pubkey: wormholeSequenceAccount,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: config.wormholeFeeCollector,
          isSigner: false,
          isWritable: true,
        },
        { pubkey: config.emitter, isSigner: false, isWritable: true },
        {
          pubkey: specialSystemAccount,
          isSigner: false,
          isWritable: false,
        },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ];

      // Instruction data for execute_proposal
      const instructionData = Buffer.from([
        // Instruction discriminator (8 bytes) for execute_proposal
        186, 60, 116, 133, 108, 128, 111, 28,
      ]);

      console.log(
        "Using custom system program account:",
        specialSystemAccount.toString()
      );

      // Add instruction directly without using the abstract format
      transaction.add({
        programId: this.programId,
        keys: accountMetas,
        data: instructionData,
      });

      // Sign the transaction in the correct order
      // First with the wormholeMessageAccount
      transaction.partialSign(wormholeMessageAccount);

      // Now handle the transaction based on the wallet's capabilities
      if (this.wallet.signAndSendTransaction) {
        // If the wallet has a signAndSendTransaction method, use it
        const signature = await this.wallet.signAndSendTransaction(transaction);
        await this.connection.confirmTransaction(signature);
        return signature;
      } else {
        // Otherwise, sign with the wallet and send manually
        const signedTx = await this.wallet.signTransaction(transaction);
        const rawTransaction = signedTx.serialize();
        const signature = await this.connection.sendRawTransaction(
          rawTransaction,
          {
            skipPreflight: false,
            preflightCommitment: "confirmed",
          }
        );
        await this.connection.confirmTransaction(signature);
        return signature;
      }
    } catch (error) {
      console.error("Error executing proposal:", error);
      // If it's a SendTransactionError, get the logs for more detail
      if (error && typeof error === "object" && "logs" in error) {
        console.error("Transaction logs:", error.logs);
      }
      throw error;
    }
  }

  /**
   * Get the Meridian config
   * @returns The Meridian config or null if not found
   */
  async getConfig(): Promise<MeridianConfig | null> {
    try {
      // Derive config PDA
      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("config")],
        this.programId
      );

      // Fetch account data directly
      const accountInfo = await this.connection.getAccountInfo(configPda);

      if (!accountInfo) {
        console.log("Config account not found");
        return null;
      }

      // Skip 8 bytes for the account discriminator
      const dataLayout = {
        authority: { bytes: 32 },
        authorizedMultisig: { bytes: 32 },
        wormholeProgram: { bytes: 32 },
        wormholeBridge: { bytes: 32 },
        wormholeFeeCollector: { bytes: 32 },
        emitter: { bytes: 32 },
        emitterBump: { bytes: 1 },
        sequence: { bytes: 8 },
        bump: { bytes: 1 },
      };

      let offset = 8; // Skip discriminator
      const config: any = {};

      // Parse fields
      for (const [field, { bytes }] of Object.entries(dataLayout)) {
        if (bytes === 32) {
          // Public key
          config[field] = new PublicKey(
            accountInfo.data.slice(offset, offset + bytes)
          );
        } else if (bytes === 8) {
          // u64/BN
          config[field] = new BN(
            accountInfo.data.slice(offset, offset + bytes),
            "le"
          );
        } else {
          // u8
          config[field] = accountInfo.data[offset];
        }
        offset += bytes;
      }

      return {
        authority: config.authority,
        authorizedMultisig: config.authorizedMultisig,
        wormholeProgram: config.wormholeProgram,
        wormholeBridge: config.wormholeBridge,
        wormholeFeeCollector: config.wormholeFeeCollector,
        emitter: config.emitter,
        emitterBump: config.emitterBump,
        sequence: config.sequence,
        bump: config.bump,
      };
    } catch (err) {
      console.error("Error fetching Meridian config:", err);
      return null;
    }
  }

  /**
   * Get a cross-chain proposal
   * @param multisig - The Squads multisig PDA
   * @param transactionIndex - The transaction index
   * @returns The proposal or null if not found
   */
  async getProposal(
    multisig: PublicKey,
    transactionIndex: number | BN
  ): Promise<CrossChainProposal | null> {
    try {
      const txIndex =
        transactionIndex instanceof BN
          ? transactionIndex
          : new BN(transactionIndex);

      // Derive proposal PDA
      const [proposalPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("proposal"),
          multisig.toBuffer(),
          txIndex.toArrayLike(Buffer, "le", 8),
        ],
        this.programId
      );

      // Fetch account data directly
      const accountInfo = await this.connection.getAccountInfo(proposalPda);

      if (!accountInfo) {
        console.log("Proposal account not found");
        return null;
      }

      // Skip 8 bytes for the account discriminator
      let offset = 8;

      // Parse multisig (pubkey - 32 bytes)
      const multisigPubkey = new PublicKey(
        accountInfo.data.slice(offset, offset + 32)
      );
      offset += 32;

      // Parse transaction_index (u64 - 8 bytes)
      const transactionIndexBN = new BN(
        accountInfo.data.slice(offset, offset + 8),
        "le"
      );
      offset += 8;

      // Parse target_chain (u16 - 2 bytes)
      const targetChain = accountInfo.data.readUInt16LE(offset);
      offset += 2;

      // Parse target_address (32 bytes array)
      const targetAddress = Array.from(
        accountInfo.data.slice(offset, offset + 32)
      );
      offset += 32;

      // Parse call_data (variable length - first 4 bytes is length)
      const callDataLength = accountInfo.data.readUInt32LE(offset);
      offset += 4;
      const callData = Buffer.from(
        accountInfo.data.slice(offset, offset + callDataLength)
      );
      offset += callDataLength;

      // Parse gas_limit (u64 - 8 bytes)
      const gasLimit = new BN(accountInfo.data.slice(offset, offset + 8), "le");
      offset += 8;

      // Parse status (enum - 1 byte)
      const statusValue = accountInfo.data[offset];
      let status: ProposalStatus;
      switch (statusValue) {
        case 0:
          status = "Pending";
          break;
        case 1:
          status = "Executed";
          break;
        case 2:
          status = "Failed";
          break;
        case 3:
          status = "Cancelled";
          break;
        default:
          status = "Pending"; // default
      }
      offset += 1;

      // Parse wormhole_sequence (Option<u64> - 1+8 bytes)
      const hasWormholeSequence = accountInfo.data[offset] === 1;
      offset += 1;
      let wormholeSequence: BN | null = null;
      if (hasWormholeSequence) {
        wormholeSequence = new BN(
          accountInfo.data.slice(offset, offset + 8),
          "le"
        );
        offset += 8;
      }

      // Parse created_at (i64 - 8 bytes)
      const createdAt = new BN(
        accountInfo.data.slice(offset, offset + 8),
        "le"
      );
      offset += 8;

      // Parse executed_at (Option<i64> - 1+8 bytes)
      const hasExecutedAt = accountInfo.data[offset] === 1;
      offset += 1;
      let executedAt: BN | null = null;
      if (hasExecutedAt) {
        executedAt = new BN(accountInfo.data.slice(offset, offset + 8), "le");
        offset += 8;
      }

      // Parse bump (u8 - 1 byte)
      const bump = accountInfo.data[offset];

      return {
        multisig: multisigPubkey,
        transactionIndex: transactionIndexBN,
        targetChain,
        targetAddress,
        callData,
        gasLimit,
        status,
        wormholeSequence,
        createdAt,
        executedAt,
        bump,
      };
    } catch (err) {
      console.error("Error fetching proposal:", err);
      return null;
    }
  }

  /**
   * Get all proposals for a multisig
   * @param multisig - The Squads multisig PDA
   * @returns Array of proposals
   */
  async getProposalsByMultisig(
    multisig: PublicKey
  ): Promise<CrossChainProposal[]> {
    try {
      // Find all accounts owned by the program
      const accounts = await this.connection.getProgramAccounts(
        this.programId,
        {
          filters: [
            // Filter by account discriminator for CrossChainProposal
            {
              memcmp: {
                offset: 0,
                bytes: bs58.encode(
                  Buffer.from([237, 244, 102, 115, 222, 254, 198, 163])
                ),
              },
            },
            // Filter by multisig pubkey
            { memcmp: { offset: 8, bytes: multisig.toBase58() } },
          ],
        }
      );

      // Parse each account
      const proposals: CrossChainProposal[] = [];
      for (const { account } of accounts) {
        let offset = 8; // Skip discriminator

        // Parse multisig (pubkey - 32 bytes)
        const multisigPubkey = new PublicKey(
          account.data.slice(offset, offset + 32)
        );
        offset += 32;

        // Parse transaction_index (u64 - 8 bytes)
        const transactionIndexBN = new BN(
          account.data.slice(offset, offset + 8),
          "le"
        );
        offset += 8;

        // Parse target_chain (u16 - 2 bytes)
        const targetChain = account.data.readUInt16LE(offset);
        offset += 2;

        // Parse target_address (32 bytes array)
        const targetAddress = Array.from(
          account.data.slice(offset, offset + 32)
        );
        offset += 32;

        // Parse call_data (variable length - first 4 bytes is length)
        const callDataLength = account.data.readUInt32LE(offset);
        offset += 4;
        const callData = Buffer.from(
          account.data.slice(offset, offset + callDataLength)
        );
        offset += callDataLength;

        // Parse gas_limit (u64 - 8 bytes)
        const gasLimit = new BN(account.data.slice(offset, offset + 8), "le");
        offset += 8;

        // Parse status (enum - 1 byte)
        const statusValue = account.data[offset];
        let status: ProposalStatus;
        switch (statusValue) {
          case 0:
            status = "Pending";
            break;
          case 1:
            status = "Executed";
            break;
          case 2:
            status = "Failed";
            break;
          case 3:
            status = "Cancelled";
            break;
          default:
            status = "Pending"; // default
        }
        offset += 1;

        // Parse wormhole_sequence (Option<u64> - 1+8 bytes)
        const hasWormholeSequence = account.data[offset] === 1;
        offset += 1;
        let wormholeSequence: BN | null = null;
        if (hasWormholeSequence) {
          wormholeSequence = new BN(
            account.data.slice(offset, offset + 8),
            "le"
          );
          offset += 8;
        }

        // Parse created_at (i64 - 8 bytes)
        const createdAt = new BN(account.data.slice(offset, offset + 8), "le");
        offset += 8;

        // Parse executed_at (Option<i64> - 1+8 bytes)
        const hasExecutedAt = account.data[offset] === 1;
        offset += 1;
        let executedAt: BN | null = null;
        if (hasExecutedAt) {
          executedAt = new BN(account.data.slice(offset, offset + 8), "le");
          offset += 8;
        }

        // Parse bump (u8 - 1 byte)
        const bump = account.data[offset];

        proposals.push({
          multisig: multisigPubkey,
          transactionIndex: transactionIndexBN,
          targetChain,
          targetAddress,
          callData,
          gasLimit,
          status,
          wormholeSequence,
          createdAt,
          executedAt,
          bump,
        });
      }

      return proposals;
    } catch (err) {
      console.error("Error fetching proposals:", err);
      return [];
    }
  }

  /**
   * Get executable proposals (approved by Squads but not yet executed by Meridian)
   * @param multisig - The Squads multisig PDA
   * @returns Array of executable proposals
   */
  async getExecutableProposals(
    multisig: PublicKey
  ): Promise<CrossChainProposal[]> {
    // Get all pending proposals for this multisig
    const proposals = await this.getProposalsByMultisig(multisig);

    // Return only pending proposals
    return proposals.filter(
      (proposal: CrossChainProposal) => proposal.status === "Pending"
    );
  }

  /**
   * Derive the Wormhole sequence account for an emitter
   * @param emitter - The emitter account
   * @returns The sequence account
   */
  private async deriveWormholeSequenceAccount(
    emitter: PublicKey
  ): Promise<PublicKey> {
    // This is an approximation - the actual derivation depends on the Wormhole program
    // In a real implementation, we would use the Wormhole SDK to derive this
    const config = await this.getConfig();
    if (!config) {
      throw new Error("Config not found");
    }

    return PublicKey.findProgramAddressSync(
      [Buffer.from("sequence"), emitter.toBuffer()],
      config.wormholeProgram
    )[0];
  }
}
