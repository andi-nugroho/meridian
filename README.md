# Project Meridian: Cross-Chain Governance System

Meridian is a cross-chain governance solution that enables Solana-based DAOs to control assets and execute transactions on EVM chains through secure, multi-party approval processes.

## Overview

Meridian bridges the gap between Solana and Ethereum-based chains by leveraging:
- **Squads Multisig** for secure on-chain governance on Solana
- **Wormhole Protocol** for secure cross-chain messaging
- **Smart Contract Architecture** for trustless execution across blockchains

![image](https://github.com/user-attachments/assets/07baae42-fb2e-430c-86a0-8ded43a14a80)

## Key Features

- **Decentralized Governance**: Use Squads multisig for robust multi-party approval workflows
- **Cross-Chain Execution**: Execute arbitrary transactions on EVM chains from Solana
- **Flexible Authorization**: Configurable permissions and security controls
- **Verifiable Messaging**: Secure message passing via Wormhole Guardian network
- **Chain-Agnostic Design**: Support for Ethereum and all EVM-compatible chains

## Architecture

Meridian consists of three core components:

1. **Solana Controller**
   - Anchor program interfacing with Squads multisig
   - Manages proposals for cross-chain transactions
   - Handles Wormhole message emission

2. **Wormhole Bridge**
   - Secures and validates cross-chain messages
   - Guardian network signs messages to ensure validity

3. **EVM Executor**
   - Smart contract receiving Wormhole messages
   - Validates signatures and permissions
   - Executes approved transactions on EVM chains

## Technology Stack

- **Solana**: Anchor framework, Rust programming language
- **EVM Chains**: Solidity, Hardhat development environment
- **Bridges**: Wormhole protocol for cross-chain communication
- **Client**: TypeScript SDK for integration and demonstrations

## Deployment Information

### Solana Program (Devnet)
- **Program ID**: `G6sHax1H3nXc5gu8YzPmgntbQR5e1CWMqYg1ekZmjDTd`
- **Emitter Address**: `0x2952a9693e82b80b49372ef94efdec6cc0ebd50ed23d2c01b3e3a365aedf375b`

### EVM Contracts (Holesky Testnet)
- **Executor Contract**: [`0xbD19c5D932AB9b15AbF7Ce1C6D352909213dc8da`](https://holesky.etherscan.io/address/0xbD19c5D932AB9b15AbF7Ce1C6D352909213dc8da)
- **Test Target Contract**: [`0xF3D2A93eb650c3E55638ba31da3CC249ef1a6956`](https://holesky.etherscan.io/address/0xF3D2A93eb650c3E55638ba31da3CC249ef1a6956)

## Getting Started

### Prerequisites

- Node.js v16+ and Yarn
- Rust and Cargo
- Solana CLI tools
- Anchor Framework 
- Access to Solana Devnet and Ethereum Holesky

### Installation

```bash
# Clone the repository
git clone https://github.com/akshatcoder-hash/meridian.git
cd meridian

# Install dependencies
yarn install

# Build the Solana program (if modifying)
cd programs/meridian
anchor build
```

### Setting Up Environment Variables

Create a `.env` file in the root directory with:

```
# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com

# Ethereum
ETHEREUM_RPC_URL=https://ethereum-holesky.publicnode.com
PRIVATE_KEY=your_ethereum_private_key_here
```

## Usage

### Running the Demo

The demo script showcases the complete flow from proposal creation to cross-chain execution:

```bash
# Run the simple demo
npx ts-node scripts/simple-demo.ts
```

This will:
1. Create a Squads multisig (if needed)
2. Initialize Meridian with the multisig
3. Create a cross-chain proposal to update a message on Ethereum
4. Approve the proposal with multiple signers
5. Execute the proposal, sending a message through Wormhole

### Deploying Your Own Contracts

#### Solana Program:
```bash
cd programs/meridian
anchor deploy --provider.cluster devnet
```

#### EVM Contracts:
```bash
cd evm
npx hardhat run scripts/deploy.ts --network holesky
```

## Security Considerations

1. **Multi-Signature Approval**: All cross-chain messages require multi-party authorization
2. **Guardian Validation**: Wormhole Guardian network validates cross-chain messages
3. **Contract Allowlisting**: Only pre-approved contracts can be called by the executor
4. **Replay Protection**: Each message can only be executed once
5. **Pausable Operation**: Emergency pause functionality for security incidents

## Future Improvements

- **Relayer Network**: Automatic message delivery between chains
- **Enhanced Permissioning**: Role-based access control for specific actions
- **Token Bridge Support**: Native token transfers with governance approvals
- **Multi-Chain Support**: Extend to additional blockchain ecosystems
- **Frontend Interface**: Develop a web interface for governance management

## Contributing

Contributions are welcome! Please feel free to submit a pull request.

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgments

- [Squads](https://squads.so/) for their Solana multisig implementation
- [Wormhole](https://wormhole.com/) for cross-chain messaging infrastructure
- [Solana Foundation](https://solana.com/)
- [Ethereum Foundation](https://ethereum.org/)
