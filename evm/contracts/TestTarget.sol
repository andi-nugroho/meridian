// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestTarget
 * @dev A simple contract that stores a message which can be updated cross-chain via Meridian
 */
contract TestTarget is Ownable {
    // The stored message
    string public message;

    // Latest update timestamp
    uint256 public lastUpdated;

    // Address that last called the contract
    address public lastCaller;

    // Number of updates
    uint256 public updateCount;

    // Events
    event MessageUpdated(string newMessage, address caller);

    /**
     * @dev Constructor
     * @param initialMessage Initial message value
     */
    constructor(string memory initialMessage) Ownable() {
        message = initialMessage;
        lastUpdated = block.timestamp;
        lastCaller = msg.sender;
        updateCount = 0;
    }

    /**
     * @dev Set a new message
     * @param newMessage The new message
     */
    function setMessage(string memory newMessage) external {
        message = newMessage;
        lastUpdated = block.timestamp;
        lastCaller = msg.sender;
        updateCount++;

        emit MessageUpdated(newMessage, msg.sender);
    }

    /**
     * @dev Get contract status
     * @return Current message
     * @return When it was last updated
     * @return Who last updated it
     * @return Number of updates
     */
    function getStatus()
        external
        view
        returns (string memory, uint256, address, uint256)
    {
        return (message, lastUpdated, lastCaller, updateCount);
    }

    /**
     * @dev Withdraw any ETH sent to the contract
     */
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    /**
     * @dev Emergency function to update the message directly
     * @param newMessage The new message
     */
    function emergencyUpdate(string memory newMessage) external onlyOwner {
        message = newMessage;
        lastUpdated = block.timestamp;
        lastCaller = msg.sender;
        updateCount++;

        emit MessageUpdated(newMessage, msg.sender);
    }

    /**
     * @dev Receive function
     */
    receive() external payable {}
}
