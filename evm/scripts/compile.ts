// A simplified script that just compiles the contracts
// @ts-ignore
const hre = require("hardhat");

async function main() {
  console.log("Compiling contracts...");

  try {
    await hre.run("compile");
    console.log("Compilation successful!");
  } catch (error) {
    console.error("Compilation failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
