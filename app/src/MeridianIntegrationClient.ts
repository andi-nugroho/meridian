import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { ethers } from "ethers";
import { MeridianSquadsClient } from "./meridian-squads-client";
import { MeridianClient } from "./meridian-client";
import { WormholeClient } from "./wormhole-client";

// ABI for MeridianExecutor
const EXECUTOR_ABI = [
  "function executeTransaction(bytes calldata encodedVAA) external",
  "function setContractAllowed(address contractAddress, bool allowed) external onlyOwner",
  "function allowedContracts(address) external view returns (bool)",
  "function owner() external view returns (address)",
];

// Example ABI for a target contract
const TARGET_ABI = [
  "function setMessage(string calldata _message) external",
  "function message() external view returns (string)",
];

/**
 * MeridianIntegrationClient integrates all components of the Meridian system
 */
export class MeridianIntegrationClient {
  private meridianSquadsClient: MeridianSquadsClient;
  private wormholeClient: WormholeClient;
  private ethProvider: ethers.JsonRpcProvider;
  private executorContract: ethers.Contract;
  private meridianProgramId: string;

  constructor(
    solanaConnection: Connection,
    solanaWallet: any, // AnchorWallet
    meridianProgramId: string,
    executorAddress: string,
    ethRpcUrl: string,
    ethPrivateKey?: string // Only needed for admin operations
  ) {
    // Store meridianProgramId for use in other methods
    this.meridianProgramId = meridianProgramId;

    // Initialize Solana clients
    this.meridianSquadsClient = new MeridianSquadsClient(
      solanaConnection,
      solanaWallet,
      meridianProgramId
    );

    this.wormholeClient = new WormholeClient(solanaConnection);

    // Initialize Ethereum provider and contract
    this.ethProvider = new ethers.JsonRpcProvider(ethRpcUrl);

    // If private key is provided, create a signer
    if (ethPrivateKey) {
      const wallet = new ethers.Wallet(ethPrivateKey, this.ethProvider);
      this.executorContract = new ethers.Contract(
        executorAddress,
        EXECUTOR_ABI,
        wallet
      );
    } else {
      // Otherwise just use read-only provider
      this.executorContract = new ethers.Contract(
        executorAddress,
        EXECUTOR_ABI,
        this.ethProvider
      );
    }
  }

  /**
   * Initialize the complete Meridian system
   */
  async initialize(
    createKey: Keypair,
    members: { key: PublicKey; permissions: any[] }[],
    threshold: number,
    wormholeProgramId: string
  ): Promise<{ multisigPda: PublicKey; initSignature: string }> {
    console.log("Initializing Meridian system...");

    // 1. Create Squads multisig
    console.log("Creating Squads multisig...");
    const { multisigPda, signature: multisigSignature } =
      await this.meridianSquadsClient.createMultisig(
        createKey,
        members,
        threshold
      );

    console.log(`Created multisig: ${multisigPda.toString()}`);

    // 2. Initialize Meridian with the multisig
    console.log("Initializing Meridian...");
    const initSignature = await this.meridianSquadsClient.initializeMeridian(
      multisigPda,
      new PublicKey(wormholeProgramId)
    );

    console.log(`Initialized Meridian: ${initSignature}`);

    return { multisigPda, initSignature };
  }

  /**
   * Set contract allowlist on the executor
   * @param targetContract The target contract to allow/disallow
   * @param allowed Whether the contract is allowed
   */
  async setContractAllowed(
    targetContract: string,
    allowed: boolean
  ): Promise<ethers.ContractTransaction> {
    // This requires an owner signer
    if (!this.executorContract.runner) {
      throw new Error("Executor contract needs a signer to set allowlist");
    }

    console.log(`Setting contract ${targetContract} allowed: ${allowed}`);
    const tx = await this.executorContract.setContractAllowed(
      targetContract,
      allowed
    );
    await tx.wait();

    console.log(`Contract ${targetContract} allowlist updated: ${allowed}`);
    return tx;
  }

  /**
   * Create a cross-chain transaction proposal
   */
  async createCrossChainProposal(
    multisigPda: PublicKey,
    targetChain: number,
    targetContract: string,
    functionName: string,
    functionArgs: any[],
    gasLimit: number = 300000
  ): Promise<{
    transactionIndex: number;
    vaultTxSignature: string;
    proposalSignature: string;
    meridianProposalSignature: string;
  }> {
    // Get the ABI interface for the target function
    const iface = new ethers.Interface(TARGET_ABI);

    // Create the call data
    const callData = iface.encodeFunctionData(functionName, functionArgs);
    console.log(`Created call data: ${callData}`);

    // Create the cross-chain proposal
    console.log("Creating cross-chain proposal...");
    const result = await this.meridianSquadsClient.createCrossChainProposal(
      multisigPda,
      targetChain,
      targetContract.startsWith("0x")
        ? targetContract.substring(2)
        : targetContract,
      Buffer.from(callData.substring(2), "hex"),
      gasLimit
    );

    console.log(
      `Created proposal with transaction index: ${result.transactionIndex}`
    );
    return result;
  }

  /**
   * Approve a proposal with multiple signers
   */
  async approveProposal(
    multisigPda: PublicKey,
    transactionIndex: number,
    signers: Keypair[]
  ): Promise<string[]> {
    const signatures: string[] = [];

    for (const signer of signers) {
      // Create a new client for each signer
      const client = new MeridianSquadsClient(
        this.meridianSquadsClient.getMeridianClient().connection,
        {
          publicKey: signer.publicKey,
          signTransaction: async (tx) => {
            tx.partialSign(signer);
            return tx;
          },
          signAllTransactions: async (txs) => {
            for (const tx of txs) {
              tx.partialSign(signer);
            }
            return txs;
          },
        },
        this.meridianProgramId // Use the stored meridianProgramId
      );

      // Approve the proposal
      const signature = await client.approveProposal(
        multisigPda,
        transactionIndex
      );

      signatures.push(signature);
      console.log(`Approved by ${signer.publicKey.toString()}: ${signature}`);
    }

    return signatures;
  }

  /**
   * Execute a proposal after it has been approved
   */
  async executeProposal(
    multisigPda: PublicKey,
    transactionIndex: number
  ): Promise<string> {
    // Check if proposal is ready to execute
    const isReady = await this.meridianSquadsClient.isProposalReadyToExecute(
      multisigPda,
      transactionIndex
    );

    if (!isReady) {
      throw new Error("Proposal is not ready to execute. Check approvals.");
    }

    // Execute the proposal
    console.log("Executing proposal...");
    const signature = await this.meridianSquadsClient.executeCrossChainProposal(
      multisigPda,
      transactionIndex
    );

    console.log(`Executed proposal: ${signature}`);
    return signature;
  }

  /**
   * Get a target contract interface
   */
  getTargetContract(targetAddress: string): ethers.Contract {
    return new ethers.Contract(targetAddress, TARGET_ABI, this.ethProvider);
  }

  /**
   * Get clients for direct access
   */
  getClients() {
    return {
      meridianSquads: this.meridianSquadsClient,
      wormhole: this.wormholeClient,
      executor: this.executorContract,
    };
  }
}
