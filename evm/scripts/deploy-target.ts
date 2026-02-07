import { ethers, network, run } from "hardhat";
import fs from "fs";
import path from "path";
import { formatEther } from "ethers";

async function main() {
  const networkName = network.name;
  console.log(`Deploying TestTarget to ${networkName}`);

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${formatEther(balance)} ETH`);

  // Deploy the TestTarget contract
  const TestTarget = await ethers.getContractFactory("TestTarget");
  const testTarget = await TestTarget.deploy("Initialized by Meridian");

  // Wait for deployment to complete
  await testTarget.waitForDeployment();

  // Get the deployed contract address
  const contractAddress = await testTarget.getAddress();
  console.log(`TestTarget deployed to: ${contractAddress}`);

  // Save deployment info to a file
  const networkInfo = await ethers.provider.getNetwork();
  const deploymentInfo = {
    network: networkName,
    chainId: Number(networkInfo.chainId),
    contractAddress: contractAddress,
    deploymentTime: new Date().toISOString(),
    initialMessage: "Initialized by Meridian",
    deployer: deployer.address,
  };

  const targetDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(targetDir, `target-${networkName}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log(
    `Deployment info saved to deployments/target-${networkName}.json`
  );

  // Verify contract on Etherscan if not on a local network
  if (
    networkName !== "hardhat" &&
    networkName !== "localhost" &&
    process.env.ETHERSCAN_API_KEY
  ) {
    console.log("Waiting for 5 block confirmations before verifying...");
    // Get deployment transaction and wait for confirmations
    const deployTx = testTarget.deploymentTransaction();
    if (deployTx) {
      await deployTx.wait(5);

      console.log("Verifying contract on Etherscan...");
      try {
        await run("verify:verify", {
          address: contractAddress,
          constructorArguments: ["Initialized by Meridian"],
        });
        console.log("Contract verified on Etherscan!");
      } catch (error) {
        console.error("Error verifying contract:", error);
      }
    }
  }

  // Create a script to update the Meridian Executor allowlist
  console.log("\nTo allow this contract in your Meridian Executor, run:");
  console.log(
    "\nnpx hardhat run scripts/allow-target.ts --network",
    networkName
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
