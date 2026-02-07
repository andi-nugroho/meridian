import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import * as multisig from "@sqds/multisig";
const { Permission } = multisig.types;
import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";
import { MeridianClient } from "../../app/src/meridian-client";
import { SquadsClient } from "../../app/src/squads-client";

// Load environment variables
require("dotenv").config();

// Constants
const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const ETHEREUM_RPC_URL =
  process.env.ETHEREUM_RPC_URL || "https://ethereum-holesky.publicnode.com";
const MERIDIAN_PROGRAM_ID = "G6sHax1H3nXc5gu8YzPmgntbQR5e1CWMqYg1ekZmjDTd";
const WORMHOLE_PROGRAM_ID = "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth";

// EVM contract addresses
const EXECUTOR_ADDRESS = "0xbD19c5D932AB9b15AbF7Ce1C6D352909213dc8da";
const TARGET_ADDRESS = "0xF3D2A93eb650c3E55638ba31da3CC249ef1a6956";

// Setup directory for saving test state
const TEST_DATA_DIR = path.join(__dirname, "../test-data");
if (!fs.existsSync(TEST_DATA_DIR)) {
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

// Load or create keypairs
function loadOrCreateKeypair(filePath: string): Keypair {
  try {
    if (fs.existsSync(filePath)) {
      const keypairData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return Keypair.fromSecretKey(Uint8Array.from(keypairData));
    } else {
      const keypair = Keypair.generate();
      fs.writeFileSync(filePath, JSON.stringify(Array.from(keypair.secretKey)));
      return keypair;
    }
  } catch (error) {
    console.error("Error loading or creating keypair:", error);
    // Fallback to generating a new keypair
    return Keypair.generate();
  }
}

// ABI for the target contract
const TARGET_ABI = [
  "function setMessage(string memory _message) external",
  "function message() external view returns (string memory)",
  "function lastCaller() external view returns (address)",
  "function lastUpdated() external view returns (uint256)",
  "function updateCount() external view returns (uint256)",
];

async function main() {
  try {
    console.log("Starting Meridian Simple Demo...");
    console.log(`Using Solana devnet: ${SOLANA_RPC_URL}`);
    console.log(`Using Ethereum Holesky: ${ETHEREUM_RPC_URL}`);
    console.log(`Meridian Program ID: ${MERIDIAN_PROGRAM_ID}`);
    console.log(`Target Contract: ${TARGET_ADDRESS}`);

    // Create keypair directory if it doesn't exist
    const keysDir = path.join(TEST_DATA_DIR, "keys");
    if (!fs.existsSync(keysDir)) {
      fs.mkdirSync(keysDir, { recursive: true });
    }

    // Load or create keypairs
    const authority = loadOrCreateKeypair(path.join(keysDir, "authority.json"));
    const member1 = loadOrCreateKeypair(path.join(keysDir, "member1.json"));
    const member2 = loadOrCreateKeypair(path.join(keysDir, "member2.json"));
    const createKey = loadOrCreateKeypair(
      path.join(keysDir, "create_key.json")
    );

    console.log("\n===============================================");
    console.log("           KEYPAIRS INFORMATION                ");
    console.log("===============================================");
    console.log(`Authority key: ${authority.publicKey.toString()}`);
    console.log(`Member1 key:   ${member1.publicKey.toString()}`);
    console.log(`Member2 key:   ${member2.publicKey.toString()}`);
    console.log(`Create key:    ${createKey.publicKey.toString()}`);
    console.log("===============================================");

    // Connect to Solana
    const connection = new Connection(SOLANA_RPC_URL, "confirmed");

    // Create provider and wallet
    const nodeWallet = new NodeWallet(authority);

    // Create a custom wallet that implements the expected interface
    const wallet = {
      publicKey: authority.publicKey,
      signTransaction: nodeWallet.signTransaction.bind(nodeWallet),
      signAllTransactions: nodeWallet.signAllTransactions.bind(nodeWallet),
      signAndSendTransaction: async (tx: any) => {
        try {
          // Check if tx is a VersionedTransaction
          if ("version" in tx) {
            // For VersionedTransaction
            tx.sign([authority]); // This will add our signature without overwriting existing ones
            const signature = await connection.sendTransaction(tx, {
              skipPreflight: false,
              preflightCommitment: "confirmed",
            });
            return signature;
          } else {
            // For legacy Transaction
            tx.partialSign(authority); // This will add our signature without overwriting existing ones
            const rawTransaction = tx.serialize();
            const signature = await connection.sendRawTransaction(
              rawTransaction,
              {
                skipPreflight: false,
                preflightCommitment: "confirmed",
              }
            );
            return signature;
          }
        } catch (error: any) {
          console.error("Error signing and sending transaction:", error);
          // Rethrow with logs if available
          if (error.logs) {
            console.error("Transaction logs:", error.logs);
          }
          throw error;
        }
      },
    };

    // Create Ethereum provider
    const ethProvider = new ethers.JsonRpcProvider(ETHEREUM_RPC_URL);
    console.log("Connected to Ethereum");

    // Create target contract interface for checking message
    const targetContract = new ethers.Contract(
      TARGET_ADDRESS,
      TARGET_ABI,
      ethProvider
    );

    // Create Squads client
    const squadsClient = new SquadsClient(connection);

    // Create Meridian client
    const meridianClient = new MeridianClient(
      connection,
      wallet,
      MERIDIAN_PROGRAM_ID
    );

    // Check current message on target contract
    try {
      const currentMessage = await targetContract.message();
      const lastCaller = await targetContract.lastCaller();
      const updateCount = await targetContract.updateCount();

      console.log("\nCurrent state of target contract:");
      console.log(`Message: "${currentMessage}"`);
      console.log(`Last caller: ${lastCaller}`);
      console.log(`Update count: ${updateCount}`);
    } catch (error) {
      console.error("Error reading from target contract:", error);
    }

    // STEP 1: Create multisig if needed
    // First check if we have a saved multisig
    let multisigPda: PublicKey;
    const multisigFile = path.join(TEST_DATA_DIR, "multisig.json");

    if (fs.existsSync(multisigFile)) {
      // Load existing multisig
      const multisigData = JSON.parse(fs.readFileSync(multisigFile, "utf-8"));
      multisigPda = new PublicKey(multisigData.multisigPda);
      console.log(`\nUsing existing multisig: ${multisigPda.toString()}`);

      // Initialize Meridian with the existing multisig
      console.log("\nReinitializing Meridian with existing multisig...");
      try {
        const initTx = await meridianClient.initialize(
          multisigPda,
          new PublicKey(WORMHOLE_PROGRAM_ID),
          new PublicKey("Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o"), // Wormhole bridge
          new PublicKey("3uTzTX5GBSfbW7eM9R9k95H7Txe32Qw3Z25MtyD2dzwC") // Wormhole fee collector
        );
        console.log(`Initialized Meridian: ${initTx}`);
      } catch (error) {
        console.error(
          "Error initializing Meridian (may already be initialized):",
          error
        );
        console.log("Continuing with existing configuration...");
      }
    } else {
      // Create a new multisig
      console.log("\nCreating new Squads multisig...");

      const { multisigPda: newMultisigPda } = await squadsClient.createMultisig(
        createKey,
        wallet,
        [
          {
            key: authority.publicKey,
            permissions: [
              Permission.Initiate,
              Permission.Vote,
              Permission.Execute,
            ],
          },
          {
            key: member1.publicKey,
            permissions: [Permission.Vote],
          },
          {
            key: member2.publicKey,
            permissions: [Permission.Vote],
          },
        ],
        2 // Threshold
      );

      multisigPda = newMultisigPda;
      console.log(`Created multisig: ${multisigPda.toString()}`);

      // Save the multisig for future runs
      fs.writeFileSync(
        multisigFile,
        JSON.stringify({ multisigPda: multisigPda.toString() })
      );

      // Initialize Meridian with the multisig
      console.log("\nInitializing Meridian...");
      const initTx = await meridianClient.initialize(
        multisigPda,
        new PublicKey(WORMHOLE_PROGRAM_ID),
        new PublicKey("Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o"), // Wormhole bridge
        new PublicKey("3uTzTX5GBSfbW7eM9R9k95H7Txe32Qw3Z25MtyD2dzwC") // Wormhole fee collector
      );

      console.log(`Initialized Meridian: ${initTx}`);
    }

    // Start creating cross-chain proposal automatically
    console.log("\nCreating a new cross-chain proposal...");

    // Generate a unique message
    const messageToSend = `Hello from Solana via Meridian! Time: ${new Date().toISOString()}`;
    console.log(`Message to send: "${messageToSend}"`);

    // Create a dummy transaction for Squads
    console.log("\nCreating Squads transaction...");
    const { transactionIndex, signature: vaultTxSig } =
      await squadsClient.createVaultTransaction(
        wallet,
        [], // Empty instructions for demo
        multisigPda
      );

    console.log(`Created transaction with index: ${transactionIndex}`);
    console.log(`Vault TX signature: ${vaultTxSig}`);

    // Create proposal
    console.log("\nCreating Squads proposal...");
    const proposalSig = await squadsClient.createProposal(
      wallet,
      transactionIndex,
      multisigPda
    );

    console.log(`Created proposal: ${proposalSig}`);

    // Create Meridian cross-chain proposal
    console.log("\nCreating Meridian cross-chain proposal...");

    // Derive the transaction PDA
    const [transactionPda] = multisig.getTransactionPda({
      multisigPda,
      index: BigInt(transactionIndex),
    });

    try {
      // Encode the setMessage function call
      const iface = new ethers.Interface(TARGET_ABI);
      const callData = iface.encodeFunctionData("setMessage", [messageToSend]);

      // Create cross-chain proposal
      const proposalResult = await meridianClient.proposeTransaction(
        multisigPda,
        transactionPda,
        transactionIndex,
        10006, // Holesky Chain ID in Wormhole format
        TARGET_ADDRESS, // Hex address
        Buffer.from(callData.slice(2), "hex"), // Remove 0x prefix
        3000000 // Gas limit
      );

      console.log(`Created cross-chain proposal: ${proposalResult}`);
    } catch (error: any) {
      console.error("Error creating cross-chain proposal:", error);

      // Check if it's a SendTransactionError
      if (error.message && error.message.includes("SendTransactionError")) {
        console.log("Transaction simulation failed. Details:");

        // Try to extract and print logs
        try {
          const logs = error.logs || [];
          console.log("Logs:", logs);

          // Look for specific errors
          if (
            logs.some((log: string) =>
              log.includes("DeclaredProgramIdMismatch")
            )
          ) {
            console.log(
              "\nERROR: The declared program ID does not match the actual program ID."
            );
            console.log("This usually happens when:");
            console.log("1. The program was redeployed with a different ID");
            console.log(
              "2. There's a mismatch between the client's programId and the on-chain program"
            );
          }
        } catch (logError) {
          console.log("Could not parse error logs:", logError);
        }
      }

      throw error; // Re-throw to stop execution
    }

    // STEP 3: Approve the proposal
    console.log("\nApproving the proposal with authority...");
    const approveSig1 = await squadsClient.approveProposal(
      wallet,
      transactionIndex,
      multisigPda
    );
    console.log(`Approved by authority: ${approveSig1}`);

    // Create a wallet for member1
    const member1Wallet = {
      publicKey: member1.publicKey,
      signTransaction: async (tx: any) => {
        // Check if tx is a VersionedTransaction
        if ("version" in tx) {
          // For VersionedTransaction
          tx.sign([member1]);
        } else {
          // For legacy Transaction
          tx.partialSign(member1);
        }
        return tx;
      },
      signAllTransactions: async (txs: any[]) => {
        for (const tx of txs) {
          // Check if tx is a VersionedTransaction
          if ("version" in tx) {
            // For VersionedTransaction
            tx.sign([member1]);
          } else {
            // For legacy Transaction
            tx.partialSign(member1);
          }
        }
        return txs;
      },
      signAndSendTransaction: async (tx: any) => {
        try {
          // Check if tx is a VersionedTransaction
          if ("version" in tx) {
            // For VersionedTransaction
            tx.sign([member1]);
            const signature = await connection.sendTransaction(tx, {
              skipPreflight: false,
              preflightCommitment: "confirmed",
            });
            return signature;
          } else {
            // For legacy Transaction
            tx.partialSign(member1);
            const rawTransaction = tx.serialize();
            const signature = await connection.sendRawTransaction(
              rawTransaction,
              {
                skipPreflight: false,
                preflightCommitment: "confirmed",
              }
            );
            return signature;
          }
        } catch (error: any) {
          console.error("Error signing and sending transaction:", error);
          // Rethrow with logs if available
          if (error.logs) {
            console.error("Transaction logs:", error.logs);
          }
          throw error;
        }
      },
    };

    console.log("\nApproving the proposal with member1...");
    const approveSig2 = await squadsClient.approveProposal(
      member1Wallet,
      transactionIndex,
      multisigPda
    );
    console.log(`Approved by member1: ${approveSig2}`);

    console.log("Transaction successfully created and approved.");
    return;

    // STEP 4: Execute the proposal
    console.log("\nChecking if proposal is ready to execute...");
    const isReady = await squadsClient.isProposalReadyToExecute(
      transactionIndex,
      multisigPda
    );

    console.log(`Proposal ready status: ${isReady}`);
    console.log(`Transaction index: ${transactionIndex}`);

    // Print current proposal status
    try {
      // Derive the proposal PDA
      const [proposalPda] = multisig.getProposalPda({
        multisigPda,
        transactionIndex: BigInt(transactionIndex),
      });

      console.log(`Proposal PDA: ${proposalPda.toString()}`);

      // Get detailed proposal info if possible
      const meridianProposal = await meridianClient.getProposal(
        multisigPda,
        transactionIndex
      );
      if (meridianProposal) {
        console.log("Meridian proposal details:");
        console.log(`- Status: ${meridianProposal?.status || "Unknown"}`);
        console.log(
          `- Target chain: ${meridianProposal?.targetChain || "Unknown"}`
        );
        console.log(
          `- Created at: ${
            meridianProposal?.createdAt?.toString() || "Unknown"
          }`
        );
      } else {
        console.log("Could not retrieve Meridian proposal details");
      }
    } catch (error) {
      console.log("Error retrieving proposal details:", error);
    }

    if (isReady) {
      console.log("Proposal is ready to execute!");

      // Derive the proposal PDA
      const [proposalPda] = multisig.getProposalPda({
        multisigPda,
        transactionIndex: BigInt(transactionIndex),
      });

      console.log("\nExecuting the proposal...");
      try {
        const executeTx = await meridianClient.executeProposal(
          multisigPda,
          proposalPda,
          transactionIndex
        );

        console.log(`Executed proposal: ${executeTx}`);
        console.log(
          `\nWormhole message sent! The message will be available after Guardians sign it.`
        );

        // Save the proposal details for manual verification later
        const proposalFile = path.join(TEST_DATA_DIR, "last-proposal.json");
        fs.writeFileSync(
          proposalFile,
          JSON.stringify({
            transactionIndex,
            targetAddress: TARGET_ADDRESS,
            message: messageToSend,
            executeTx,
          })
        );

        console.log(
          `\nTo verify message delivery, check the message on Holesky:`
        );
        console.log(
          `https://holesky.etherscan.io/address/${TARGET_ADDRESS}#readContract`
        );

        console.log(
          "\nNote: The message may take some time to be delivered by the Wormhole Guardians."
        );
        console.log(
          "Run this script again in a few minutes to check if the message was delivered."
        );

        // Remind users of the keypairs for future runs
        console.log("\n===============================================");
        console.log("  REMEMBER THESE KEYPAIRS FOR FUTURE RUNS  ");
        console.log("===============================================");
        console.log(`Authority key: ${authority.publicKey.toString()}`);
        console.log(`Member1 key:   ${member1.publicKey.toString()}`);
        console.log(`Member2 key:   ${member2.publicKey.toString()}`);
        console.log(`Create key:    ${createKey.publicKey.toString()}`);
        console.log("===============================================");
      } catch (error) {
        console.error("Error executing proposal:", error);
      }
    } else {
      console.log(
        "Proposal is not ready to execute. Check if it has enough approvals."
      );
    }
  } catch (error) {
    console.error("Error in demo:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
