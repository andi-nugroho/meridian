// @ts-nocheck
import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import * as multisig from "@sqds/multisig";
import { Permission } from "@sqds/multisig/lib/types";
import * as fs from "fs";
import * as path from "path";
import { MeridianSquadsClient } from "/Users/akshatsharma/meridian/app/src/meridian-squads-client";
import { ethers } from "ethers";

// Load environment variables
require("dotenv").config();

// Constants
const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const ETHEREUM_RPC_URL =
  process.env.ETHEREUM_RPC_URL || "https://goerli.infura.io/v3/YOUR_INFURA_KEY";
const MERIDIAN_PROGRAM_ID = "G6sHax1H3nXc5gu8YzPmgntbQR5e1CWMqYg1ekZmjDTd";
const WORMHOLE_PROGRAM_ID = "worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth";

// Target details for our cross-chain transaction
// This is an example of calling a setMessage function on a SimpleStorage contract
const TARGET_CHAIN = 2; // Ethereum
const TARGET_CONTRACT = "0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78"; // Replace with your contract
const FUNCTION_SIGNATURE = "setMessage(string)";
const MESSAGE = "Hello from Solana via Meridian!";

// ABI for the function we want to call
const functionFragment = "function setMessage(string memory _message)";

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

async function main() {
  try {
    console.log("Starting Meridian Demo...");

    // Create directory for keys if it doesn't exist
    const keysDir = path.join(__dirname, "../keys");
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

    console.log(`Authority pubkey: ${authority.publicKey.toString()}`);
    console.log(`Member1 pubkey: ${member1.publicKey.toString()}`);
    console.log(`Member2 pubkey: ${member2.publicKey.toString()}`);

    // Connect to Solana
    const connection = new Connection(SOLANA_RPC_URL, "confirmed");

    // Request airdrops for the keypairs if needed
    await requestAirdropIfNeeded(connection, authority.publicKey);
    await requestAirdropIfNeeded(connection, member1.publicKey);
    await requestAirdropIfNeeded(connection, member2.publicKey);

    // Create provider and wallet
    const wallet = new NodeWallet(authority);
    const provider = new AnchorProvider(connection, wallet, {});

    // Create Meridian client
    const meridianClient = new MeridianSquadsClient(
      connection,
      wallet,
      MERIDIAN_PROGRAM_ID
    );

    // 1. Create a Squads multisig
    console.log("\n1. Creating Squads multisig...");

    const { multisigPda } = await meridianClient.createMultisig(
      createKey,
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

    console.log(`Multisig created: ${multisigPda.toString()}`);

    // 2. Initialize Meridian
    console.log("\n2. Initializing Meridian...");

    const initTx = await meridianClient.initializeMeridian(
      multisigPda,
      new PublicKey(WORMHOLE_PROGRAM_ID)
    );

    console.log(`Meridian initialized: ${initTx}`);

    // 3. Create a target contract call
    console.log("\n3. Preparing cross-chain transaction...");

    // Create call data for the target contract
    const ethInterface = new ethers.utils.Interface([functionFragment]);
    const callData = ethInterface.encodeFunctionData("setMessage", [MESSAGE]);

    console.log(`Call data created: ${callData}`);

    // Convert Ethereum address to bytes32 format
    const targetAddressHex = TARGET_CONTRACT.startsWith("0x")
      ? TARGET_CONTRACT.slice(2)
      : TARGET_CONTRACT;

    // 4. Create cross-chain proposal
    console.log("\n4. Creating cross-chain proposal...");

    const proposalResult = await meridianClient.createCrossChainProposal(
      multisigPda,
      TARGET_CHAIN,
      targetAddressHex,
      Buffer.from(callData.slice(2), "hex"), // Remove 0x prefix
      300000 // Gas limit
    );

    console.log(`Cross-chain proposal created:`);
    console.log(`  Transaction index: ${proposalResult.transactionIndex}`);
    console.log(`  Vault TX signature: ${proposalResult.vaultTxSignature}`);
    console.log(`  Proposal signature: ${proposalResult.proposalSignature}`);
    console.log(
      `  Meridian proposal signature: ${proposalResult.meridianProposalSignature}`
    );

    // 5. Approve the proposal (authority is already one vote)
    console.log("\n5. Approving the proposal...");

    // Switch wallet to member1 for second approval
    const member1Wallet = new NodeWallet(member1);
    const member1Provider = new AnchorProvider(connection, member1Wallet, {});
    const member1Client = new MeridianSquadsClient(
      connection,
      member1Wallet,
      MERIDIAN_PROGRAM_ID
    );

    // Add second approval
    const approvalTx = await member1Client.approveProposal(
      multisigPda,
      proposalResult.transactionIndex
    );

    console.log(`Proposal approved by member1: ${approvalTx}`);

    // 6. Check if proposal is ready to execute
    console.log("\n6. Checking if proposal is ready to execute...");

    const isReady = await meridianClient.isProposalReadyToExecute(
      multisigPda,
      proposalResult.transactionIndex
    );

    console.log(`Proposal ready to execute: ${isReady}`);

    if (isReady) {
      // 7. Execute the proposal
      console.log("\n7. Executing the proposal...");

      const executeTx = await meridianClient.executeCrossChainProposal(
        multisigPda,
        proposalResult.transactionIndex
      );

      console.log(`Proposal executed: ${executeTx}`);
      console.log(
        `\nWormhole message sent! The transaction will be executed on Ethereum.`
      );
      console.log(
        `In a production environment, a Wormhole relayer would deliver and execute the VAA.`
      );
    } else {
      console.log(
        `Proposal is not ready to execute. Check if it has enough approvals.`
      );
    }

    console.log("\nDemo completed successfully!");
  } catch (error) {
    console.error("Error in demo:", error);
  }
}

async function requestAirdropIfNeeded(
  connection: Connection,
  publicKey: PublicKey,
  minBalance: number = 1 * LAMPORTS_PER_SOL
) {
  try {
    const balance = await connection.getBalance(publicKey);

    if (balance < minBalance) {
      console.log(`Requesting airdrop for ${publicKey.toString()}`);
      const signature = await connection.requestAirdrop(
        publicKey,
        minBalance - balance
      );
      await connection.confirmTransaction(signature);
      console.log(`Airdrop completed: ${signature}`);
    }
  } catch (error) {
    console.error(`Error requesting airdrop: ${error}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
