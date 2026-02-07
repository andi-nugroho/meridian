import { PublicKey } from "@solana/web3.js";

// Meridian program ID
const MERIDIAN_PROGRAM_ID = "G6sHax1H3nXc5gu8YzPmgntbQR5e1CWMqYg1ekZmjDTd";

function main() {
  // Derive the emitter PDA
  const [emitterPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("emitter")],
    new PublicKey(MERIDIAN_PROGRAM_ID)
  );

  console.log("Meridian Program ID:", MERIDIAN_PROGRAM_ID);
  console.log("Emitter PDA:", emitterPda.toBase58());
  console.log("Bump:", bump);

  // Convert to 32-byte format for Wormhole
  // Wormhole expects addresses in a 32-byte format without the base58 encoding
  const emitterBytes = Buffer.alloc(32);
  emitterPda.toBuffer().copy(emitterBytes);
  
  console.log("\nEmitter address for .env file (Wormhole format):");
  console.log(`SOLANA_EMITTER_ADDRESS=0x${emitterBytes.toString("hex")}`);
}

main();