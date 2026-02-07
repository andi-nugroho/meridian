import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import fetch from "node-fetch";

type WormholeNetwork = "MAINNET" | "TESTNET" | "DEVNET";

export class WormholeClient {
  private connection: Connection;
  private network: WormholeNetwork;
  private wormholeRpcUrl: string;
  
  constructor(
    connection: Connection,
    network: WormholeNetwork = "TESTNET"
  ) {
    this.connection = connection;
    this.network = network;
    
    // Set Wormhole RPC URL based on network
    switch (network) {
      case "MAINNET":
        this.wormholeRpcUrl = "https://wormhole-v2-mainnet-api.certus.one";
        break;
      case "TESTNET":
        this.wormholeRpcUrl = "https://wormhole-v2-testnet-api.certus.one";
        break;
      case "DEVNET":
        this.wormholeRpcUrl = "https://wormhole-v2-devnet-api.certus.one";
        break;
      default:
        this.wormholeRpcUrl = "https://wormhole-v2-testnet-api.certus.one";
    }
  }
  
  /**
   * Get a signed VAA from Wormhole
   * @param emitterChain Emitter chain ID
   * @param emitterAddress Emitter address (hex string without 0x)
   * @param sequence Sequence number
   * @returns The VAA bytes or null if not found
   */
  async getSignedVAA(
    emitterChain: number,
    emitterAddress: string,
    sequence: number
  ): Promise<string | null> {
    try {
      // Remove 0x prefix if present
      const cleanEmitterAddress = emitterAddress.startsWith("0x") 
        ? emitterAddress.slice(2) 
        : emitterAddress;
      
      const response = await fetch(`${this.wormholeRpcUrl}/v1/signed_vaa/${emitterChain}/${cleanEmitterAddress}/${sequence}`);
      const data = await response.json();
      
      if (data.vaaBytes) {
        return data.vaaBytes;
      }
      
      return null;
    } catch (error) {
      console.error("Error fetching VAA:", error);
      return null;
    }
  }
  
  /**
   * Wait for a VAA to be signed
   * @param emitterChain Emitter chain ID
   * @param emitterAddress Emitter address (hex string without 0x)
   * @param sequence Sequence number
   * @param timeout Timeout in milliseconds
   * @param retryInterval Retry interval in milliseconds
   * @returns The VAA bytes or null if timeout
   */
  async waitForVAA(
    emitterChain: number,
    emitterAddress: string,
    sequence: number,
    timeout: number = 60000,
    retryInterval: number = 5000
  ): Promise<string | null> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const vaa = await this.getSignedVAA(emitterChain, emitterAddress, sequence);
      
      if (vaa) {
        return vaa;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
    
    console.error("Timeout waiting for VAA");
    return null;
  }
  
  /**
   * Get Wormhole emitter address for a Solana program
   * @param programId The program ID
   * @returns The emitter address in the format expected by Wormhole
   */
  getEmitterAddressForProgram(programId: PublicKey): string {
    // For Solana, we calculate the emitter PDA with seed "emitter"
    const [emitterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("emitter")],
      programId
    );
    
    // Convert to bytes
    const emitterBytes = Buffer.alloc(32);
    emitterPda.toBuffer().copy(emitterBytes);
    
    return "0x" + emitterBytes.toString("hex");
  }
  
  /**
   * Parse Wormhole sequence number from a Solana transaction
   * @param txid The transaction ID
   * @returns The sequence number or null if not found
   */
  async parseWormholeSequence(txid: string): Promise<number | null> {
    try {
      // Get transaction details
      const tx = await this.connection.getParsedTransaction(
        txid,
        { maxSupportedTransactionVersion: 0 }
      );
      
      if (!tx) {
        return null;
      }
      
      // Look through logs for sequence info
      // This is a simplified approach - in production, you'd want to parse
      // the logs more carefully or use a more robust approach
      const logs = tx.meta?.logMessages || [];
      
      for (const log of logs) {
        if (log.includes("sequence")) {
          const match = log.match(/sequence: (\d+)/);
          if (match && match[1]) {
            return parseInt(match[1], 10);
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error("Error parsing sequence:", error);
      return null;
    }
  }
  
  /**
   * Get Wormhole Chain ID for Solana
   */
  getSolanaChainId(): number {
    return 1; // Solana is chain ID 1 in Wormhole
  }
  
  /**
   * Get Wormhole Chain ID for Ethereum
   */
  getEthereumChainId(): number {
    return 2; // Ethereum is chain ID 2 in Wormhole
  }
  
  /**
   * Get Wormhole Chain ID for Holesky testnet
   */
  getHoleskyChainId(): number {
    return 10006; // Holesky testnet specific ID
  }
}