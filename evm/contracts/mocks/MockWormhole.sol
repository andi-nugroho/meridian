// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IWormhole.sol";

/**
 * @title MockWormhole
 * @dev Mock implementation of the Wormhole Core Bridge for testing
 */
contract MockWormhole is IWormhole {
    // The chain ID for this chain
    uint16 private _chainId = 2; // Default to Ethereum

    // Mock VM data
    IWormhole.VM private _vm;

    // Mock verification result
    bool private _isValid = true;
    string private _invalidReason = "";

    /**
     * @dev Set the verification result
     * @param isValid Whether the VM is valid
     * @param reason The reason if invalid
     */
    function setVerifyVM(bool isValid, string memory reason) external {
        _isValid = isValid;
        _invalidReason = reason;
    }

    /**
     * @dev Set the VM data for testing
     * @param vm The VM data
     */
    function setVMData(IWormhole.VM memory vm) external {
        _vm = vm;
    }

    /**
     * @dev Set the chain ID
     * @param chainId The new chain ID
     */
    function setChainId(uint16 chainId) external {
        _chainId = chainId;
    }

    /**
     * @dev Parse and verify a VM (VAA)
     * @param encodedVM The encoded VM (ignored in mock)
     * @return vm The VM
     * @return valid Whether the VM is valid
     * @return reason The reason if invalid
     */
    function parseAndVerifyVM(
        bytes calldata encodedVM
    )
        external
        view
        override
        returns (VM memory vm, bool valid, string memory reason)
    {
        // Return the mock data regardless of input
        return (_vm, _isValid, _invalidReason);
    }

    /**
     * @dev Get the chain ID
     * @return The chain ID
     */
    function chainId() external view override returns (uint16) {
        return _chainId;
    }

    /**
     * @dev Get the governance contract address
     * @return The governance contract address
     */
    function governanceContract() external view override returns (bytes32) {
        return bytes32(0);
    }
}
