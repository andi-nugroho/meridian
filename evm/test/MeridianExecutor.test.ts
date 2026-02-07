// @ts-nocheck
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract, ContractFactory } from "ethers";

describe("MeridianExecutor", function () {
  let meridianExecutor: Contract;
  let mockWormholeBridge: Contract;
  let mockTarget: Contract;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let attacker: SignerWithAddress;
  let solanaEmitterAddress: string;

  beforeEach(async function () {
    // Get signers
    [owner, user, attacker] = await ethers.getSigners();

    // Deploy mock Wormhole bridge
    const MockWormhole = await ethers.getContractFactory("MockWormhole");
    mockWormholeBridge = await MockWormhole.deploy();
    await mockWormholeBridge.deployed();

    // Deploy mock target contract
    const MockTarget = await ethers.getContractFactory("MockTarget");
    mockTarget = await MockTarget.deploy();
    await mockTarget.deployed();

    // Set up Solana emitter address (32 bytes)
    solanaEmitterAddress = ethers.utils.hexZeroPad("0x1234", 32);

    // Deploy MeridianExecutor
    const MeridianExecutor = await ethers.getContractFactory(
      "MeridianExecutor"
    );
    meridianExecutor = await MeridianExecutor.deploy(
      mockWormholeBridge.address,
      solanaEmitterAddress
    );
    await meridianExecutor.deployed();

    // Allow the mock target contract
    await meridianExecutor.setContractAllowed(mockTarget.address, true);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await meridianExecutor.owner()).to.equal(owner.address);
    });

    it("Should set the correct Wormhole bridge", async function () {
      expect(await meridianExecutor.wormholeBridge()).to.equal(
        mockWormholeBridge.address
      );
    });

    it("Should set the correct Solana emitter address", async function () {
      expect(await meridianExecutor.solanaEmitterAddress()).to.equal(
        solanaEmitterAddress
      );
    });
  });

  describe("Configuration", function () {
    it("Should allow owner to change the Wormhole bridge", async function () {
      await meridianExecutor.setWormholeBridge(user.address);
      expect(await meridianExecutor.wormholeBridge()).to.equal(user.address);
    });

    it("Should not allow non-owner to change the Wormhole bridge", async function () {
      await expect(
        meridianExecutor.connect(user).setWormholeBridge(user.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow owner to change the Solana emitter address", async function () {
      const newEmitterAddress = ethers.utils.hexZeroPad("0x5678", 32);
      await meridianExecutor.setSolanaEmitterAddress(newEmitterAddress);
      expect(await meridianExecutor.solanaEmitterAddress()).to.equal(
        newEmitterAddress
      );
    });

    it("Should not allow non-owner to change the Solana emitter address", async function () {
      const newEmitterAddress = ethers.utils.hexZeroPad("0x5678", 32);
      await expect(
        meridianExecutor
          .connect(user)
          .setSolanaEmitterAddress(newEmitterAddress)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow owner to update contract allowlist", async function () {
      await meridianExecutor.setContractAllowed(user.address, true);
      expect(await meridianExecutor.allowedContracts(user.address)).to.equal(
        true
      );

      await meridianExecutor.setContractAllowed(user.address, false);
      expect(await meridianExecutor.allowedContracts(user.address)).to.equal(
        false
      );
    });

    it("Should not allow non-owner to update contract allowlist", async function () {
      await expect(
        meridianExecutor.connect(user).setContractAllowed(user.address, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow owner to pause and unpause the contract", async function () {
      // Pause the contract
      await meridianExecutor.pause();
      expect(await meridianExecutor.paused()).to.equal(true);

      // Create a mock VAA
      const mockVAA = generateMockVAA({
        emitterChainId: 1,
        emitterAddress: solanaEmitterAddress,
        targetContract: mockTarget.address,
        callData: mockTarget.interface.encodeFunctionData("setValue", [42]),
        gasLimit: 100000,
      });

      // Setup mock Wormhole response
      await mockWormholeBridge.setVerifyVM(true, "");

      // Try to execute while paused
      await expect(
        meridianExecutor.executeTransaction(mockVAA)
      ).to.be.revertedWith("Pausable: paused");

      // Unpause
      await meridianExecutor.unpause();
      expect(await meridianExecutor.paused()).to.equal(false);

      // Now it should work
      await expect(meridianExecutor.executeTransaction(mockVAA)).to.not.be
        .reverted;
    });

    it("Should not allow non-owner to pause or unpause", async function () {
      await expect(meridianExecutor.connect(user).pause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      // Pause as owner
      await meridianExecutor.pause();

      await expect(meridianExecutor.connect(user).unpause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("Transaction Execution", function () {
    it("Should execute a valid transaction from a VAA", async function () {
      // Create a mock VAA
      const mockVAA = generateMockVAA({
        emitterChainId: 1, // Solana
        emitterAddress: solanaEmitterAddress,
        targetContract: mockTarget.address,
        callData: mockTarget.interface.encodeFunctionData("setValue", [42]),
        gasLimit: 100000,
      });

      // Setup mock Wormhole response
      await mockWormholeBridge.setVerifyVM(true, "");

      // Execute the transaction
      await expect(meridianExecutor.executeTransaction(mockVAA))
        .to.emit(meridianExecutor, "TransactionExecuted")
        .withArgs(
          1, // sequence
          "0x0000000000000000000000000000000000000000000000000000000000000000", // proposalAccount
          mockTarget.address,
          100000, // gasLimit
          mockTarget.interface.encodeFunctionData("setValue", [42]),
          true, // success
          "0x" // result
        );

      // Verify the target contract state was updated
      expect(await mockTarget.value()).to.equal(42);
    });

    it("Should prevent replay attacks", async function () {
      // Create a mock VAA
      const mockVAA = generateMockVAA({
        emitterChainId: 1, // Solana
        emitterAddress: solanaEmitterAddress,
        targetContract: mockTarget.address,
        callData: mockTarget.interface.encodeFunctionData("setValue", [42]),
        gasLimit: 100000,
      });

      // Setup mock Wormhole response
      await mockWormholeBridge.setVerifyVM(true, "");

      // Execute the transaction
      await meridianExecutor.executeTransaction(mockVAA);

      // Try to replay the same VAA
      await expect(
        meridianExecutor.executeTransaction(mockVAA)
      ).to.be.revertedWith("VAA already processed");
    });

    it("Should reject invalid VAAs", async function () {
      // Create a mock VAA
      const mockVAA = generateMockVAA({
        emitterChainId: 1, // Solana
        emitterAddress: solanaEmitterAddress,
        targetContract: mockTarget.address,
        callData: mockTarget.interface.encodeFunctionData("setValue", [42]),
        gasLimit: 100000,
      });

      // Setup mock Wormhole response to indicate invalid VAA
      await mockWormholeBridge.setVerifyVM(false, "Invalid signature");

      // Try to execute the transaction
      await expect(
        meridianExecutor.executeTransaction(mockVAA)
      ).to.be.revertedWith("Invalid VAA: Invalid signature");
    });

    it("Should reject VAAs from unauthorized emitters", async function () {
      // Create a mock VAA with wrong emitter
      const wrongEmitterAddress = ethers.utils.hexZeroPad("0x9999", 32);
      const mockVAA = generateMockVAA({
        emitterChainId: 1, // Solana
        emitterAddress: wrongEmitterAddress,
        targetContract: mockTarget.address,
        callData: mockTarget.interface.encodeFunctionData("setValue", [42]),
        gasLimit: 100000,
      });

      // Setup mock Wormhole response
      await mockWormholeBridge.setVerifyVM(true, "");

      // Try to execute the transaction
      await expect(
        meridianExecutor.executeTransaction(mockVAA)
      ).to.be.revertedWith("VAA not from authorized emitter");
    });

    it("Should reject VAAs from wrong chain ID", async function () {
      // Create a mock VAA with wrong chain ID
      const mockVAA = generateMockVAA({
        emitterChainId: 2, // Ethereum, not Solana
        emitterAddress: solanaEmitterAddress,
        targetContract: mockTarget.address,
        callData: mockTarget.interface.encodeFunctionData("setValue", [42]),
        gasLimit: 100000,
      });

      // Setup mock Wormhole response
      await mockWormholeBridge.setVerifyVM(true, "");

      // Try to execute the transaction
      await expect(
        meridianExecutor.executeTransaction(mockVAA)
      ).to.be.revertedWith("VAA not from Solana");
    });

    it("Should reject VAAs targeting non-allowed contracts", async function () {
      // Create a mock VAA targeting a non-allowed contract
      const mockVAA = generateMockVAA({
        emitterChainId: 1, // Solana
        emitterAddress: solanaEmitterAddress,
        targetContract: user.address, // Not on allowlist
        callData: "0x12345678",
        gasLimit: 100000,
      });

      // Setup mock Wormhole response
      await mockWormholeBridge.setVerifyVM(true, "");

      // Try to execute the transaction
      await expect(
        meridianExecutor.executeTransaction(mockVAA)
      ).to.be.revertedWith("Target contract not allowed");
    });

    it("Should handle execution failures gracefully", async function () {
      // Create a mock VAA calling a function that will revert
      const mockVAA = generateMockVAA({
        emitterChainId: 1, // Solana
        emitterAddress: solanaEmitterAddress,
        targetContract: mockTarget.address,
        callData: mockTarget.interface.encodeFunctionData("revertWithMessage", [
          "Error message",
        ]),
        gasLimit: 100000,
      });

      // Setup mock Wormhole response
      await mockWormholeBridge.setVerifyVM(true, "");

      // Execute the transaction
      await expect(meridianExecutor.executeTransaction(mockVAA))
        .to.emit(meridianExecutor, "ExecutionFailed")
        .withArgs(
          1, // sequence
          "0x0000000000000000000000000000000000000000000000000000000000000000", // proposalAccount
          mockTarget.address,
          "Error message"
        );
    });

    it("Should reject VAAs with excessive gas limit", async function () {
      // Create a mock VAA with excessive gas limit
      const mockVAA = generateMockVAA({
        emitterChainId: 1,
        emitterAddress: solanaEmitterAddress,
        targetContract: mockTarget.address,
        callData: mockTarget.interface.encodeFunctionData("setValue", [42]),
        gasLimit: 2000000, // Over the max limit
      });

      // Setup mock Wormhole response
      await mockWormholeBridge.setVerifyVM(true, "");

      // Try to execute the transaction
      await expect(
        meridianExecutor.executeTransaction(mockVAA)
      ).to.be.revertedWith("Gas limit too high");
    });

    it("Should execute a transaction that sets multiple values", async function () {
      // Create a mock VAA to set multiple values
      const mockVAA = generateMockVAA({
        emitterChainId: 1,
        emitterAddress: solanaEmitterAddress,
        targetContract: mockTarget.address,
        callData: mockTarget.interface.encodeFunctionData("setMultipleValues", [
          123,
          "Hello from Meridian",
          true,
        ]),
        gasLimit: 200000,
      });

      // Setup mock Wormhole response
      await mockWormholeBridge.setVerifyVM(true, "");

      // Execute the transaction
      await meridianExecutor.executeTransaction(mockVAA);

      // Verify all values were set correctly
      expect(await mockTarget.value()).to.equal(123);
      expect(await mockTarget.message()).to.equal("Hello from Meridian");
      expect(await mockTarget.flag()).to.equal(true);
      expect(await mockTarget.lastCaller()).to.equal(meridianExecutor.address);
    });

    it("Should handle transactions with different sequence numbers", async function () {
      // Create first VAA with sequence 1
      const mockVAA1 = generateMockVAA({
        emitterChainId: 1,
        emitterAddress: solanaEmitterAddress,
        targetContract: mockTarget.address,
        callData: mockTarget.interface.encodeFunctionData("setValue", [1]),
        gasLimit: 100000,
        sequence: 1,
      });

      // Create second VAA with sequence 2
      const mockVAA2 = generateMockVAA({
        emitterChainId: 1,
        emitterAddress: solanaEmitterAddress,
        targetContract: mockTarget.address,
        callData: mockTarget.interface.encodeFunctionData("setValue", [2]),
        gasLimit: 100000,
        sequence: 2,
      });

      // Setup mock Wormhole response
      await mockWormholeBridge.setVerifyVM(true, "");

      // Execute the transactions in reverse order (should work fine)
      await meridianExecutor.executeTransaction(mockVAA2);
      expect(await mockTarget.value()).to.equal(2);

      await meridianExecutor.executeTransaction(mockVAA1);
      expect(await mockTarget.value()).to.equal(1);

      // Verify both sequences are marked as processed
      expect(await meridianExecutor.processedSequences(1)).to.equal(true);
      expect(await meridianExecutor.processedSequences(2)).to.equal(true);
    });
  });

  // Helper function to generate mock VAA data
  function generateMockVAA({
    emitterChainId = 1,
    emitterAddress,
    targetContract,
    callData,
    gasLimit = 100000,
    sequence = 1,
    timestamp = Math.floor(Date.now() / 1000),
    nonce = 0,
  }: {
    emitterChainId?: number;
    emitterAddress: string;
    targetContract: string;
    callData: string;
    gasLimit?: number;
    sequence?: number;
    timestamp?: number;
    nonce?: number;
  }): string {
    // This is a simplified mock - in a real test, you would use the Wormhole SDK
    // to generate a valid VAA or create a more accurate simulation

    // The mock Wormhole bridge will return predefined values when parseAndVerifyVM is called
    mockWormholeBridge.setVMData({
      version: 1,
      timestamp,
      nonce,
      emitterChainId,
      emitterAddress,
      sequence,
      consistencyLevel: 1,
      payload: createMockPayload(
        targetContract,
        callData,
        gasLimit,
        sequence,
        timestamp,
        nonce
      ),
      guardianSetIndex: 0,
      signatures: "0x",
      hash: ethers.utils.keccak256("0x1234"),
    });

    // In a real test, this would be the VAA bytes
    return "0x1234";
  }

  // Helper function to create a mock payload
  function createMockPayload(
    targetContract: string,
    callData: string,
    gasLimit: number,
    sequence: number,
    timestamp: number,
    nonce: number
  ): string {
    // Strip 0x prefix if present
    const cleanCallData = callData.startsWith("0x")
      ? callData.slice(2)
      : callData;

    // Convert to Buffer
    const callDataBuffer = Buffer.from(cleanCallData, "hex");

    // Create the payload buffer (matching the MeridianExecutor.parsePayload format)
    let payload = Buffer.alloc(1024); // Start with a large buffer
    let offset = 0;

    // Version (1 byte)
    payload.writeUInt8(1, offset);
    offset += 1;

    // Message type (1 byte)
    payload.writeUInt8(1, offset); // MESSAGE_TYPE_TRANSACTION
    offset += 1;

    // Sequence (8 bytes)
    payload.writeBigUInt64LE(BigInt(sequence), offset);
    offset += 8;

    // Timestamp (8 bytes)
    payload.writeBigUInt64LE(BigInt(timestamp), offset);
    offset += 8;

    // Nonce (4 bytes)
    payload.writeUInt32LE(nonce, offset);
    offset += 4;

    // Proposal account (32 bytes) - using zeros for test
    const proposalAccount = Buffer.alloc(32);
    proposalAccount.copy(payload, offset);
    offset += 32;

    // Target address (32 bytes)
    const targetAddressBytes = ethers.utils.arrayify(
      ethers.utils.hexZeroPad(targetContract, 32)
    );
    Buffer.from(targetAddressBytes).copy(payload, offset);
    offset += 32;

    // Gas limit (8 bytes)
    payload.writeBigUInt64LE(BigInt(gasLimit), offset);
    offset += 8;

    // Call data length (4 bytes)
    payload.writeUInt32LE(callDataBuffer.length, offset);
    offset += 4;

    // Call data (variable)
    callDataBuffer.copy(payload, offset);
    offset += callDataBuffer.length;

    // Return only the used portion of the buffer
    return "0x" + payload.slice(0, offset).toString("hex");
  }
});
