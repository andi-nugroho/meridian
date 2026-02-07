// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/IWormhole.sol";

/**
 * @title MeridianExecutor
 * @dev Receives and executes cross-chain messages from the Meridian program on Solana
 */
contract MeridianExecutor is Ownable, ReentrancyGuard, Pausable {
    // ========== CONSTANTS ==========

    // Wormhole chain ID for Solana
    uint16 public constant CHAIN_ID_SOLANA = 1;

    // Message type for transactions
    uint8 public constant MESSAGE_TYPE_TRANSACTION = 1;

    // Maximum gas for execution
    uint256 public constant MAX_GAS_LIMIT = 1000000;

    // ========== STATE VARIABLES ==========

    // Wormhole Core Bridge
    address public wormholeBridge;

    // The Solana emitter address (32 bytes)
    bytes32 public solanaEmitterAddress;

    // Processed sequences to prevent replay
    mapping(uint64 => bool) public processedSequences;

    // Allowlist of contracts that can be called
    mapping(address => bool) public allowedContracts;

    // ========== EVENTS ==========

    event TransactionExecuted(
        uint64 sequence,
        bytes32 proposalAccount,
        address targetContract,
        uint256 gasLimit,
        bytes callData,
        bool success,
        bytes result
    );

    event ExecutionFailed(
        uint64 sequence,
        bytes32 proposalAccount,
        address targetContract,
        string reason
    );

    event ContractAllowListUpdated(address contractAddress, bool allowed);

    // ========== CONSTRUCTOR ==========

    constructor(address _wormholeBridge, bytes32 _solanaEmitterAddress) {
        wormholeBridge = _wormholeBridge;
        solanaEmitterAddress = _solanaEmitterAddress;
    }

    // ========== EXTERNAL FUNCTIONS ==========

    /**
     * @dev Set the Wormhole Core Bridge address
     * @param _wormholeBridge New bridge address
     */
    function setWormholeBridge(address _wormholeBridge) external onlyOwner {
        require(_wormholeBridge != address(0), "Invalid bridge address");
        wormholeBridge = _wormholeBridge;
    }

    /**
     * @dev Set the Solana emitter address
     * @param _solanaEmitterAddress New emitter address
     */
    function setSolanaEmitterAddress(
        bytes32 _solanaEmitterAddress
    ) external onlyOwner {
        require(_solanaEmitterAddress != bytes32(0), "Invalid emitter address");
        solanaEmitterAddress = _solanaEmitterAddress;
    }

    /**
     * @dev Add or remove a contract from the allowlist
     * @param contractAddress Contract address
     * @param allowed Whether the contract is allowed
     */
    function setContractAllowed(
        address contractAddress,
        bool allowed
    ) external onlyOwner {
        allowedContracts[contractAddress] = allowed;
        emit ContractAllowListUpdated(contractAddress, allowed);
    }

    /**
     * @dev Pause execution of transactions
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause execution of transactions
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Execute a transaction from a Wormhole VAA
     * @param encodedVAA The encoded VAA from Wormhole
     */
    function executeTransaction(
        bytes calldata encodedVAA
    ) external nonReentrant whenNotPaused {
        // Parse and verify the VAA
        (IWormhole.VM memory vm, bool valid, string memory reason) = IWormhole(
            wormholeBridge
        ).parseAndVerifyVM(encodedVAA);

        // Ensure the VAA is valid
        require(valid, string(abi.encodePacked("Invalid VAA: ", reason)));

        // Verify the VAA is from Solana and our emitter
        require(vm.emitterChainId == CHAIN_ID_SOLANA, "VAA not from Solana");
        require(
            vm.emitterAddress == solanaEmitterAddress,
            "VAA not from authorized emitter"
        );

        // Check if this VAA has already been processed
        require(!processedSequences[vm.sequence], "VAA already processed");

        // Parse the payload
        (
            uint8 version,
            uint8 messageType,
            uint64 sequence,
            uint64 timestamp,
            uint32 nonce,
            bytes32 proposalAccount,
            address targetContract,
            uint64 gasLimit,
            bytes memory callData
        ) = parsePayload(vm.payload);

        // Validate message type and version
        require(version == 1, "Invalid payload version");
        require(
            messageType == MESSAGE_TYPE_TRANSACTION,
            "Invalid message type"
        );

        // Validate the target contract is allowed
        require(
            allowedContracts[targetContract],
            "Target contract not allowed"
        );

        // Validate gas limit
        require(gasLimit <= MAX_GAS_LIMIT, "Gas limit too high");

        // Mark the sequence as processed
        processedSequences[vm.sequence] = true;

        // Execute the transaction
        bool success;
        bytes memory result;

        try this.executeCall{gas: gasLimit}(targetContract, callData) returns (
            bool _success,
            bytes memory _result
        ) {
            success = _success;
            result = _result;

            emit TransactionExecuted(
                sequence,
                proposalAccount,
                targetContract,
                gasLimit,
                callData,
                success,
                result
            );
        } catch Error(string memory errorReason) {
            emit ExecutionFailed(
                sequence,
                proposalAccount,
                targetContract,
                errorReason
            );
        } catch (bytes memory) {
            emit ExecutionFailed(
                sequence,
                proposalAccount,
                targetContract,
                "Unknown execution error"
            );
        }
    }

    /**
     * @dev Execute a call to a target contract
     * @param target Target contract address
     * @param data Call data
     * @return success Whether the call succeeded
     * @return result The call result
     */
    function executeCall(
        address target,
        bytes calldata data
    ) external returns (bool success, bytes memory result) {
        require(msg.sender == address(this), "Unauthorized");

        // Execute the call
        (success, result) = target.call(data);
        return (success, result);
    }

    // ========== INTERNAL FUNCTIONS ==========

    /**
     * @dev Parse the Meridian payload
     * @param payload The payload bytes
     */
    function parsePayload(
        bytes memory payload
    )
        internal
        pure
        returns (
            uint8 version,
            uint8 messageType,
            uint64 sequence,
            uint64 timestamp,
            uint32 nonce,
            bytes32 proposalAccount,
            address targetContract,
            uint64 gasLimit,
            bytes memory callData
        )
    {
        require(payload.length >= 98, "Payload too short"); // 1 + 1 + 8 + 8 + 4 + 32 + 32 + 8 + 4 (minimum size)

        uint256 index = 0;

        // Extract version (1 byte)
        version = uint8(payload[index]);
        index += 1;

        // Extract message type (1 byte)
        messageType = uint8(payload[index]);
        index += 1;

        // Extract sequence (8 bytes)
        sequence = uint64(bytes8(extractBytes(payload, index, 8)));
        index += 8;

        // Extract timestamp (8 bytes)
        timestamp = uint64(bytes8(extractBytes(payload, index, 8)));
        index += 8;

        // Extract nonce (4 bytes)
        nonce = uint32(bytes4(extractBytes(payload, index, 4)));
        index += 4;

        // Extract proposal account (32 bytes)
        proposalAccount = bytes32(extractBytes(payload, index, 32));
        index += 32;

        // Extract target address (32 bytes)
        bytes32 targetAddressBytes = bytes32(extractBytes(payload, index, 32));
        targetContract = addressFromBytes32(targetAddressBytes);
        index += 32;

        // Extract gas limit (8 bytes)
        gasLimit = uint64(bytes8(extractBytes(payload, index, 8)));
        index += 8;

        // Extract call data length (4 bytes)
        uint32 callDataLength = uint32(bytes4(extractBytes(payload, index, 4)));
        index += 4;

        // Extract call data (variable)
        require(
            payload.length >= index + callDataLength,
            "Invalid call data length"
        );
        callData = extractBytes(payload, index, callDataLength);
    }

    /**
     * @dev Extract bytes from a byte array
     * @param data The source byte array
     * @param start The start index
     * @param length The length to extract
     * @return The extracted bytes
     */
    function extractBytes(
        bytes memory data,
        uint256 start,
        uint256 length
    ) internal pure returns (bytes memory) {
        bytes memory result = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = data[start + i];
        }
        return result;
    }

    /**
     * @dev Convert bytes32 to address
     * @param data The bytes32 value
     * @return The address
     */
    function addressFromBytes32(bytes32 data) internal pure returns (address) {
        return address(uint160(uint256(data)));
    }
}
