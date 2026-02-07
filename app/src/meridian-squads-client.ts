import * as multisig from "@sqds/multisig";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { MeridianClient } from "./meridian-client";

// Extract Permission and Permissions types from multisig namespace
const { Permission, Permissions } = multisig.types;
// Define a type alias for Permission to use in method signatures
type PermissionType = (typeof Permission)[keyof typeof Permission];

export class MeridianSquadsClient {
  private connection: Connection;
  private squadsProgram: PublicKey;
  private meridianClient: MeridianClient;

  constructor(
    connection: Connection,
    wallet: any, // AnchorWallet
    meridianProgramId?: string,
    squadsProgramId: string = "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf"
  ) {
    this.connection = connection;
    this.squadsProgram = new PublicKey(squadsProgramId);
    this.meridianClient = new MeridianClient(
      connection,
      wallet,
      meridianProgramId
    );
  }

  /**
   * Create a new Squads multisig
   * @param createKey - One-time keypair for derivation
   * @param members - List of members with their permissions
   * @param threshold - Approval threshold
   * @returns The multisig PDA and transaction signature
   */
  async createMultisig(
    createKey: Keypair,
    members: { key: PublicKey; permissions: PermissionType[] }[],
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
    const formattedMembers = members.map(
      (member: { key: PublicKey; permissions: PermissionType[] }) => ({
        key: member.key,
        permissions: Permissions.fromPermissions(member.permissions),
      })
    );

    // Create the instruction
    const ix = await multisig.instructions.multisigCreateV2({
      createKey: createKey.publicKey,
      creator: this.meridianClient.wallet.publicKey,
      multisigPda,
      configAuthority: null,
      timeLock: 0,
      members: formattedMembers,
      threshold,
      treasury: programConfig.treasury,
      rentCollector: null,
    });

    // Build and send the transaction
    const latestBlockhash = await this.connection.getLatestBlockhash();

    const messageV0 = new TransactionMessage({
      payerKey: this.meridianClient.wallet.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [ix],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Need to sign with both creator and createKey
    // The wallet adapter will sign with creator
    transaction.sign([createKey]);

    const signature = await this.meridianClient.wallet.sendTransaction(
      transaction,
      this.connection
    );
    await this.connection.confirmTransaction(signature);

    return { multisigPda, signature };
  }

  /**
   * Initialize Meridian with a Squads multisig
   * @param multisigPda - Squads multisig PDA
   * @param wormholeProgram - Wormhole program ID
   * @returns Transaction signature
   */
  async initializeMeridian(
    multisigPda: PublicKey,
    wormholeProgram: PublicKey = new PublicKey(
      "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth"
    )
  ): Promise<string> {
    // Derive standard Wormhole accounts for devnet or testnet
    // In a production implementation, you'd fetch these dynamically
    const wormholeBridge = PublicKey.findProgramAddressSync(
      [Buffer.from("Bridge")],
      wormholeProgram
    )[0];

    const wormholeFeeCollector = PublicKey.findProgramAddressSync(
      [Buffer.from("fee_collector")],
      wormholeProgram
    )[0];

    // Initialize Meridian
    return await this.meridianClient.initialize(
      multisigPda,
      wormholeProgram,
      wormholeBridge,
      wormholeFeeCollector
    );
  }

  /**
   * Create a Squads vault transaction for a cross-chain proposal
   * @param multisigPda - Squads multisig PDA
   * @param targetChain - Target chain ID (Wormhole format)
   * @param targetAddress - Target contract address
   * @param callData - Function call data
   * @param gasLimit - Gas limit
   * @param vaultIndex - Vault index (default: 0)
   * @returns The transaction index and signatures
   */
  async createCrossChainProposal(
    multisigPda: PublicKey,
    targetChain: number,
    targetAddress: string,
    callData: Buffer | Uint8Array,
    gasLimit: number,
    vaultIndex: number = 0
  ): Promise<{
    transactionIndex: number;
    vaultTxSignature: string;
    proposalSignature: string;
    meridianProposalSignature: string;
  }> {
    try {
      // 1. Get multisig info to determine the next transaction index
      const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
        this.connection,
        multisigPda
      );

      const currentTransactionIndex = Number(multisigInfo.transactionIndex);
      const newTransactionIndex = BigInt(currentTransactionIndex + 1);

      // 2. Create a dummy transaction for Squads
      // In real implementation, you might want to create a proper transaction
      // or use the existing transaction creation method in your workflow

      // Derive the vault PDA
      const [vaultPda] = multisig.getVaultPda({
        multisigPda,
        index: vaultIndex,
      });

      // Create a simple transfer instruction as a placeholder
      // Replace this with your actual transaction if needed
      const dummyIx = await multisig.instructions.proposalCreate({
        multisigPda,
        transactionIndex: newTransactionIndex,
        creator: this.meridianClient.wallet.publicKey,
      });

      // 3. Create the vault transaction
      const latestBlockhash = await this.connection.getLatestBlockhash();

      const vaultTxMessage = new TransactionMessage({
        payerKey: this.meridianClient.wallet.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: [dummyIx],
      }).compileToV0Message();

      const vaultTx = new VersionedTransaction(vaultTxMessage);
      const vaultTxSignature = await this.meridianClient.wallet.sendTransaction(
        vaultTx,
        this.connection
      );
      await this.connection.confirmTransaction(vaultTxSignature);

      // 4. Create the Squads proposal
      const createProposalIx = await multisig.instructions.proposalCreate({
        multisigPda,
        transactionIndex: newTransactionIndex,
        creator: this.meridianClient.wallet.publicKey,
      });

      const proposalMessage = new TransactionMessage({
        payerKey: this.meridianClient.wallet.publicKey,
        recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
        instructions: [createProposalIx],
      }).compileToV0Message();

      const proposalTx = new VersionedTransaction(proposalMessage);
      const proposalSignature =
        await this.meridianClient.wallet.sendTransaction(
          proposalTx,
          this.connection
        );
      await this.connection.confirmTransaction(proposalSignature);

      // 5. Get the transaction PDA
      const [transactionPda] = multisig.getTransactionPda({
        multisigPda,
        index: newTransactionIndex,
      });

      // 6. Create the Meridian cross-chain proposal
      const meridianProposalSignature =
        await this.meridianClient.proposeTransaction(
          multisigPda,
          transactionPda,
          Number(newTransactionIndex),
          targetChain,
          targetAddress,
          Buffer.from(callData),
          gasLimit
        );

      return {
        transactionIndex: Number(newTransactionIndex),
        vaultTxSignature,
        proposalSignature,
        meridianProposalSignature,
      };
    } catch (error) {
      console.error("Error creating cross-chain proposal:", error);
      throw error;
    }
  }

  /**
   * Approve a Squads proposal
   * @param multisigPda - Squads multisig PDA
   * @param transactionIndex - Transaction index
   * @returns Transaction signature
   */
  async approveProposal(
    multisigPda: PublicKey,
    transactionIndex: number
  ): Promise<string> {
    // Create the approval instruction
    const ix = await multisig.instructions.proposalApprove({
      multisigPda,
      transactionIndex: BigInt(transactionIndex),
      member: this.meridianClient.wallet.publicKey,
    });

    // Build and send the transaction
    const latestBlockhash = await this.connection.getLatestBlockhash();

    const messageV0 = new TransactionMessage({
      payerKey: this.meridianClient.wallet.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [ix],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    const signature = await this.meridianClient.wallet.sendTransaction(
      transaction,
      this.connection
    );
    await this.connection.confirmTransaction(signature);

    return signature;
  }

  /**
   * Execute a Meridian proposal after it has been approved by the multisig
   * @param multisigPda - Squads multisig PDA
   * @param transactionIndex - Transaction index
   * @returns Transaction signature
   */
  async executeCrossChainProposal(
    multisigPda: PublicKey,
    transactionIndex: number
  ): Promise<string> {
    // Get the proposal PDA from Squads
    const [proposalPda] = multisig.getProposalPda({
      multisigPda,
      transactionIndex: BigInt(transactionIndex),
    });

    // Execute the Meridian proposal
    return await this.meridianClient.executeProposal(
      multisigPda,
      proposalPda,
      transactionIndex
    );
  }

  /**
   * Check if a proposal is ready to execute
   * @param multisigPda - Squads multisig PDA
   * @param transactionIndex - Transaction index
   * @returns True if the proposal can be executed
   */
  async isProposalReadyToExecute(
    multisigPda: PublicKey,
    transactionIndex: number
  ): Promise<boolean> {
    try {
      // Get the Squads proposal status
      const [proposalPda] = multisig.getProposalPda({
        multisigPda,
        transactionIndex: BigInt(transactionIndex),
      });

      const proposal = await multisig.accounts.Proposal.fromAccountAddress(
        this.connection,
        proposalPda
      );

      // Check if the proposal's status indicates it's ready to execute
      // In Squads v4, this is typically when the status has "__kind" of "Approved"
      return (
        proposal.status.__kind === "Approved" ||
        proposal.status.__kind === "Executed"
      );
    } catch (error) {
      console.error("Error checking proposal status:", error);
      return false;
    }
  }

  /**
   * Get the Meridian client
   * @returns The Meridian client
   */
  getMeridianClient(): MeridianClient {
    return this.meridianClient;
  }
}
