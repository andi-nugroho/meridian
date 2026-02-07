import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
// We use require instead of import for hardhat
// @ts-ignore
const hre = require("hardhat");
const { ethers, network, run } = hre;

dotenv.config();

async function main() {
  console.log("Deploying MeridianExecutor to", network.name);

  // Get network details
  const networkName = network.name;

  // Get chainId in a more compatible way
  let chainId: number;
  try {
    // Try different approaches to get chainId
    if (network.config && network.config.chainId) {
      // Use hardhat network config if available
      chainId = network.config.chainId;
    } else {
      // Fallback - get from provider
      const provider = ethers.provider;
      const networkInfo = await provider.getNetwork();
      chainId =
        typeof networkInfo.chainId === "bigint"
          ? Number(networkInfo.chainId)
          : Number(networkInfo.chainId);
    }
  } catch (error) {
    console.error("Error getting chainId:", error);
    // Fallback to default chainId for the network
    if (networkName === "holesky") {
      chainId = 17000;
    } else if (networkName === "mainnet") {
      chainId = 1;
    } else {
      chainId = 31337; // Default for hardhat
    }
    console.log(`Using fallback chainId: ${chainId}`);
  }

  // Set Wormhole bridge address based on network
  let wormholeBridge: string;

  if (networkName === "holesky") {
    // Holesky's Wormhole Core Bridge
    wormholeBridge =
      process.env.WORMHOLE_CORE_BRIDGE ||
      "0x85120384dab9a466a22bebce5ad8c754a897d343";
  } else if (networkName === "mainnet") {
    wormholeBridge = "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B";
  } else {
    // Default for local testing (mock address)
    wormholeBridge = "0xC89Ce4735882C9F0f0FE26686c53074E09B0D550";
    console.log("Using mock Wormhole bridge for local development");
  }

  console.log(
    `Deploying to ${networkName} (chainId: ${chainId}) with Wormhole bridge: ${wormholeBridge}`
  );

  // Get the emitter address from env or use a default for testing
  // This should be the Solana emitter address in bytes32 format
  const solanaEmitterAddressHex =
    process.env.SOLANA_EMITTER_ADDRESS ||
    "0x0000000000000000000000000000000000000000000000000000000000000000";

  console.log(`Using Solana emitter address: ${solanaEmitterAddressHex}`);

  // Get deployer account in a compatible way
  let deployer;
  try {
    // Try to get signers directly
    const [signer] = await ethers.getSigners();
    deployer = signer;
  } catch (error) {
    console.error("Error getting signers, trying alternative approach:", error);
    try {
      // Alternative approach for ethers compatibility
      deployer = new ethers.Wallet(
        process.env.PRIVATE_KEY || "",
        ethers.provider
      );
    } catch (innerError) {
      console.error("Failed to create wallet:", innerError);
      throw new Error(
        "Cannot get deployer account. Please check your configuration."
      );
    }
  }

  console.log(`Deploying with account: ${deployer.address}`);

  // Check balance
  const provider = ethers.provider;
  const balance = await provider.getBalance(deployer.address);

  // Format balance in a way that works with both ethers v5 and v6
  let formattedBalance;
  try {
    // Try ethers v6 approach
    formattedBalance = ethers.formatEther(balance);
  } catch (error) {
    try {
      // Fallback to ethers v5 approach
      formattedBalance = ethers.utils.formatEther(balance);
    } catch (innerError) {
      // Last resort - convert manually
      formattedBalance = (Number(balance) / 1e18).toString();
    }
  }

  console.log(`Account balance: ${formattedBalance} ETH`);

  // Create minBalance in a way that works with both ethers v5 and v6
  let minBalance;
  try {
    // Try ethers v6 approach
    minBalance = ethers.parseEther("0.01");
  } catch (error) {
    try {
      // Fallback to ethers v5 approach
      minBalance = ethers.utils.parseEther("0.01");
    } catch (innerError) {
      // Last resort - convert manually (1e16 = 0.01 ETH in wei)
      minBalance = BigInt("10000000000000000");
    }
  }

  // Compare balance with minBalance safely
  const balanceTooLow =
    balance < minBalance ||
    (typeof balance.lt === "function" && balance.lt(minBalance));

  if (balanceTooLow) {
    console.warn("WARNING: Deployer account has less than 0.01 ETH!");
    if (networkName !== "hardhat" && networkName !== "localhost") {
      console.error("Aborting deployment due to low balance");
      return;
    }
  }

  // Deploy the MeridianExecutor contract
  console.log("Deploying MeridianExecutor...");
  const MeridianExecutor = await ethers.getContractFactory("MeridianExecutor");
  const executor = await MeridianExecutor.deploy(
    wormholeBridge,
    solanaEmitterAddressHex
  );

  await executor.waitForDeployment();
  const executorAddress = await executor.getAddress();

  console.log(`MeridianExecutor deployed to: ${executorAddress}`);

  // Save deployment info to a file
  const deploymentInfo = {
    network: networkName,
    chainId: chainId,
    contractAddress: executorAddress,
    wormholeBridge,
    solanaEmitterAddress: solanaEmitterAddressHex,
    deploymentTime: new Date().toISOString(),
    deployer: deployer.address,
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(deploymentsDir, `${networkName}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log(`Deployment info saved to deployments/${networkName}.json`);

  // Verify contract on Etherscan if not on a local network
  if (
    networkName !== "hardhat" &&
    networkName !== "localhost" &&
    process.env.ETHERSCAN_API_KEY
  ) {
    console.log("Waiting for block confirmations before verifying...");

    try {
      // Ethers v6 changes - wait for confirmations
      const deployTx = executor.deploymentTransaction();
      if (deployTx) {
        await deployTx.wait(5);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait 60 seconds as fallback
      }

      console.log("Verifying contract on Etherscan...");
      await run("verify:verify", {
        address: executorAddress,
        constructorArguments: [wormholeBridge, solanaEmitterAddressHex],
      });
      console.log("Contract verified on Etherscan!");
    } catch (error) {
      console.error("Error verifying contract:", error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
