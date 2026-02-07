import { ethers, network } from "hardhat";
import { BaseContract } from "ethers";
import fs from "fs";
import path from "path";

// Extend ContractTransaction to include wait() and hash properties
interface ExtendedContractTransaction {
  wait(): Promise<any>;
  hash: string;
}

// Define the interface for the MeridianExecutor contract
interface MeridianExecutorInterface extends BaseContract {
  allowedContracts(address: string): Promise<boolean>;
  setContractAllowed(
    address: string,
    allowed: boolean
  ): Promise<ExtendedContractTransaction>;
}

async function main() {
  const networkName = network.name;
  console.log(`Setting up allowlist on ${networkName}`);

  // Load deployments
  const executorFilePath = path.join(
    __dirname,
    `../deployments/${networkName}.json`
  );
  const targetFilePath = path.join(
    __dirname,
    `../deployments/target-${networkName}.json`
  );

  if (!fs.existsSync(executorFilePath)) {
    console.error(`Executor deployment file not found at ${executorFilePath}`);
    return;
  }

  if (!fs.existsSync(targetFilePath)) {
    console.error(`Target deployment file not found at ${targetFilePath}`);
    return;
  }

  // Load deployment info
  const executorInfo = JSON.parse(fs.readFileSync(executorFilePath, "utf8"));
  const targetInfo = JSON.parse(fs.readFileSync(targetFilePath, "utf8"));

  const executorAddress = executorInfo.contractAddress;
  const targetAddress = targetInfo.contractAddress;

  console.log(`Executor contract: ${executorAddress}`);
  console.log(`Target contract: ${targetAddress}`);

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`Using account: ${signer.address}`);

  // Load executor contract
  const MeridianExecutor = await ethers.getContractFactory("MeridianExecutor");
  const executor = MeridianExecutor.attach(
    executorAddress
  ) as unknown as MeridianExecutorInterface;

  // Check if already allowed
  const isAllowed = await executor.allowedContracts(targetAddress);
  if (isAllowed) {
    console.log(`Target contract ${targetAddress} is already allowed`);
    return;
  }

  // Add to allowlist
  console.log(`Adding target contract ${targetAddress} to allowlist...`);
  const tx = await executor.setContractAllowed(targetAddress, true);
  await tx.wait();

  console.log(`Transaction hash: ${tx.hash}`);
  console.log(
    `Target contract ${targetAddress} has been added to the allowlist!`
  );

  // Verify it's allowed
  const allowedAfter = await executor.allowedContracts(targetAddress);
  console.log(`Verification - Target contract is allowed: ${allowedAfter}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
