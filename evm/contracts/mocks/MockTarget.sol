// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockTarget
 * @dev Mock target contract for testing MeridianExecutor
 */
contract MockTarget {
    // State variables that can be modified by calls
    uint256 public value;
    string public message;
    address public lastCaller;
    uint256 public lastValue;
    bool public flag;

    // Events for tracking calls
    event ValueSet(uint256 newValue);
    event MessageSet(string newMessage);
    event EtherReceived(address sender, uint256 amount);
    event FunctionCalled(string functionName, address caller);

    /**
     * @dev Set the value
     * @param newValue The new value
     */
    function setValue(uint256 newValue) external {
        value = newValue;
        lastCaller = msg.sender;
        emit ValueSet(newValue);
        emit FunctionCalled("setValue", msg.sender);
    }

    /**
     * @dev Set the message
     * @param newMessage The new message
     */
    function setMessage(string calldata newMessage) external {
        message = newMessage;
        lastCaller = msg.sender;
        emit MessageSet(newMessage);
        emit FunctionCalled("setMessage", msg.sender);
    }

    /**
     * @dev Set multiple values
     * @param newValue The new numeric value
     * @param newMessage The new message
     * @param newFlag The new flag value
     */
    function setMultipleValues(
        uint256 newValue,
        string calldata newMessage,
        bool newFlag
    ) external {
        value = newValue;
        message = newMessage;
        flag = newFlag;
        lastCaller = msg.sender;
        emit FunctionCalled("setMultipleValues", msg.sender);
    }

    /**
     * @dev Function that reverts with a message
     * @param errorMessage The error message
     */
    function revertWithMessage(string calldata errorMessage) external pure {
        revert(errorMessage);
    }

    /**
     * @dev Function that runs out of gas
     */
    function consumeAllGas() external {
        while (true) {
            // Infinite loop to consume all gas
        }
    }

    /**
     * @dev Reset all state variables
     */
    function reset() external {
        value = 0;
        message = "";
        lastCaller = address(0);
        lastValue = 0;
        flag = false;
        emit FunctionCalled("reset", msg.sender);
    }

    /**
     * @dev Get a complex return value
     * @return Multiple values in a tuple
     */
    function getComplexReturn()
        external
        view
        returns (uint256, string memory, address)
    {
        return (value, message, lastCaller);
    }

    /**
     * @dev Receive ETH
     */
    receive() external payable {
        lastCaller = msg.sender;
        lastValue = msg.value;
        emit EtherReceived(msg.sender, msg.value);
    }
}
