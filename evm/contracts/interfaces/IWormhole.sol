// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IWormhole
 * @dev Interface for the Wormhole Core Bridge
 */
interface IWormhole {
    struct VM {
        uint8 version;
        uint32 timestamp;
        uint32 nonce;
        uint16 emitterChainId;
        bytes32 emitterAddress;
        uint64 sequence;
        uint8 consistencyLevel;
        bytes payload;
        uint32 guardianSetIndex;
        bytes signatures;
        bytes32 hash;
    }

    /**
     * @dev Parse and verify a Wormhole message
     * @param encodedVM The encoded VAA
     * @return vm The parsed VAA
     * @return valid Whether the VAA is valid
     * @return reason The reason if the VAA is invalid
     */
    function parseAndVerifyVM(
        bytes calldata encodedVM
    ) external view returns (VM memory vm, bool valid, string memory reason);

    /**
     * @dev Get the chain ID of this chain
     * @return The chain ID
     */
    function chainId() external view returns (uint16);

    /**
     * @dev Get the address of the Wormhole contract on this chain (in bytes32 format)
     * @return The contract address
     */
    function governanceContract() external view returns (bytes32);
}
