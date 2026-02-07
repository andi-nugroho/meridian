import * as multisig from "@sqds/multisig";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
} from "@solana/web3.js";
// Extract Permission and Permissions types from multisig namespace
const { Permission, Permissions } = multisig.types;

// Helper function to extract instruction from multisig instruction result
function extractInstruction(ixResult: any): TransactionInstruction {
  // Check if the result has an instruction property
  if (ixResult && "instruction" in ixResult) {
    return ixResult.instruction as TransactionInstruction;
  }
  return ixResult as TransactionInstruction;
}

export class SquadsClient {
  private connection: Connection;
  private multisigPda?: PublicKey;

  constructor(connection: Connection, multisigPda?: PublicKey) {
    this.connection = connection;
    this.multisigPda = multisigPda;
  }

  /**
   * Create a new Squads multisig
   */
  async createMultisig(
    createKey: Keypair,
    wallet: any, // AnchorWallet
    members: {
      key: PublicKey;
      permissions: (typeof Permission)[keyof typeof Permission][];
    }[],
    threshold: number
  ): Promise<{ multisigPda: PublicKey; signature: string }> {
    // Derive the multisig PDA
    const [multisigPda] = multisig.getMultisigPda({
      createKey: createKey.publicKey,
    });

    // Get the program configuration
    const programConfigPda = multisig.getProgramConfigPda({})[0];
    const programConfig =
      await multisig.accounts.ProgramConfig.fromAccountAddress(
        this.connection,
        programConfigPda
      );

    // Format members with permissions
    const formattedMembers = members.map((member) => ({
      key: member.key,
      permissions: Permissions.fromPermissions(member.permissions),
    }));

    // Create the instruction
    const ixResult = await multisig.instructions.multisigCreateV2({
      createKey: createKey.publicKey,
      creator: wallet.publicKey,
      multisigPda,
      configAuthority: null,
      timeLock: 0,
      members: formattedMembers,
      threshold,
      treasury: programConfig.treasury,
      rentCollector: null,
    });

    // Extract the instruction
    const instruction = extractInstruction(ixResult);

    // Build and send the transaction
    const latestBlockhash = await this.connection.getLatestBlockhash();

    const messageV0 = new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [instruction],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Need to sign with both creator and createKey
    transaction.sign([createKey]);

    const signature = await wallet.signAndSendTransaction(transaction);
    await this.connection.confirmTransaction(signature);

    // Update the multisigPda
    this.multisigPda = multisigPda;

    return { multisigPda, signature };
  }

  /**
   * Get the current transaction index from the multisig
   */
  async getCurrentTransactionIndex(multisigPda?: PublicKey): Promise<number> {
    const pda = multisigPda || this.multisigPda;
    if (!pda) {
      throw new Error("Multisig PDA not set");
    }

    const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
      this.connection,
      pda
    );

    return Number(multisigInfo.transactionIndex);
  }

  /**
   * Create a vault transaction
   */
  async createVaultTransaction(
    wallet: any, // AnchorWallet
    instructions: any[],
    multisigPda?: PublicKey,
    vaultIndex = 0,
    memo = "Meridian transaction"
  ): Promise<{ transactionIndex: number; signature: string }> {
    const pda = multisigPda || this.multisigPda;
    if (!pda) {
      throw new Error("Multisig PDA not set");
    }

    // Get the vault PDA
    const [vaultPda] = multisig.getVaultPda({
      multisigPda: pda,
      index: vaultIndex,
    });

    // Get the current transaction index
    const currentTransactionIndex = await this.getCurrentTransactionIndex(pda);
    const newTransactionIndex = BigInt(currentTransactionIndex + 1);

    // Build the transaction message
    const latestBlockhash = await this.connection.getLatestBlockhash();
    const transactionMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: latestBlockhash.blockhash,
      instructions,
    });

    // Create the vault transaction
    const ixResult = await multisig.instructions.vaultTransactionCreate({
      multisigPda: pda,
      transactionIndex: newTransactionIndex,
      creator: wallet.publicKey,
      vaultIndex,
      ephemeralSigners: 0,
      transactionMessage,
      memo,
    });

    // Extract the instruction
    const instruction = extractInstruction(ixResult);

    // Build and send the transaction
    const messageV0 = new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [instruction],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    const signature = await wallet.signAndSendTransaction(transaction);
    await this.connection.confirmTransaction(signature);

    return {
      transactionIndex: Number(newTransactionIndex),
      signature,
    };
  }

  /**
   * Create a proposal for a transaction
   */
  async createProposal(
    wallet: any, // AnchorWallet
    transactionIndex: number,
    multisigPda?: PublicKey
  ): Promise<string> {
    const pda = multisigPda || this.multisigPda;
    if (!pda) {
      throw new Error("Multisig PDA not set");
    }

    // Create the proposal
    const ixResult = await multisig.instructions.proposalCreate({
      multisigPda: pda,
      transactionIndex: BigInt(transactionIndex),
      creator: wallet.publicKey,
    });

    // Extract the instruction
    const instruction = extractInstruction(ixResult);

    // Build and send the transaction
    const latestBlockhash = await this.connection.getLatestBlockhash();

    const messageV0 = new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [instruction],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    const signature = await wallet.signAndSendTransaction(transaction);
    await this.connection.confirmTransaction(signature);

    return signature;
  }

  /**
   * Approve a proposal
   */
  async approveProposal(
    wallet: any, // AnchorWallet
    transactionIndex: number,
    multisigPda?: PublicKey
  ): Promise<string> {
    const pda = multisigPda || this.multisigPda;
    if (!pda) {
      throw new Error("Multisig PDA not set");
    }

    // Create the approval instruction
    const ixResult = await multisig.instructions.proposalApprove({
      multisigPda: pda,
      transactionIndex: BigInt(transactionIndex),
      member: wallet.publicKey,
    });

    // Extract the instruction
    const instruction = extractInstruction(ixResult);

    // Build and send the transaction
    const latestBlockhash = await this.connection.getLatestBlockhash();

    const messageV0 = new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [instruction],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    const signature = await wallet.signAndSendTransaction(transaction);
    await this.connection.confirmTransaction(signature);

    return signature;
  }

  /**
   * Execute a vault transaction after it's been approved
   */
  async executeVaultTransaction(
    wallet: any, // AnchorWallet
    transactionIndex: number,
    multisigPda?: PublicKey
  ): Promise<string> {
    const pda = multisigPda || this.multisigPda;
    if (!pda) {
      throw new Error("Multisig PDA not set");
    }

    // Create the execute instruction
    const ixResult = await multisig.instructions.vaultTransactionExecute({
      connection: this.connection,
      multisigPda: pda,
      transactionIndex: BigInt(transactionIndex),
      member: wallet.publicKey,
    });

    // Extract the instruction
    const instruction = extractInstruction(ixResult);

    // Build and send the transaction
    const latestBlockhash = await this.connection.getLatestBlockhash();

    const messageV0 = new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [instruction],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    const signature = await wallet.signAndSendTransaction(transaction);
    await this.connection.confirmTransaction(signature);

    return signature;
  }

  /**
   * Get the proposal status
   */
  async getProposalStatus(
    transactionIndex: number,
    multisigPda?: PublicKey
  ): Promise<any> {
    const pda = multisigPda || this.multisigPda;
    if (!pda) {
      throw new Error("Multisig PDA not set");
    }

    // Derive the proposal PDA
    const [proposalPda] = multisig.getProposalPda({
      multisigPda: pda,
      transactionIndex: BigInt(transactionIndex),
    });

    try {
      const proposalAccount =
        await multisig.accounts.Proposal.fromAccountAddress(
          this.connection,
          proposalPda
        );

      return {
        status: proposalAccount.status,
        approved: proposalAccount.approved,
        rejected: proposalAccount.rejected,
        cancelled: proposalAccount.cancelled,
        bump: proposalAccount.bump,
      };
    } catch (error) {
      console.error("Failed to fetch proposal:", error);
      return null;
    }
  }

  /**
   * Check if a proposal is ready to execute
   */
  async isProposalReadyToExecute(
    transactionIndex: number,
    multisigPda?: PublicKey
  ): Promise<boolean> {
    const status = await this.getProposalStatus(transactionIndex, multisigPda);
    if (!status) return false;

    // Get the multisig to check threshold
    const pda = multisigPda || this.multisigPda;
    if (!pda) {
      throw new Error("Multisig PDA not set");
    }

    try {
      const multisigAccount =
        await multisig.accounts.Multisig.fromAccountAddress(
          this.connection,
          pda
        );

      console.log(`Multisig threshold: ${multisigAccount.threshold}`);
      console.log(`Proposal approval count: ${status.approved.length}`);

      // Debug the status object
      console.log("Status object:", JSON.stringify(status.status, null, 2));
      console.log(`Approvals: ${status.approved.join(", ")}`);

      const thresholdMet = status.approved.length >= multisigAccount.threshold;
      console.log(`Is threshold met? ${thresholdMet}`);

      return thresholdMet;
    } catch (error) {
      console.error("Failed to check execute readiness:", error);
      return false;
    }
  }
}
