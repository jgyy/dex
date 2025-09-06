const hre = require("hardhat");

async function main() {
  console.log("Deploying contracts...");

  // Deploy Token A
  const TokenA = await hre.ethers.getContractFactory("Token");
  const tokenA = await TokenA.deploy(
    "Token A",
    "TKNA",
    1000000, // 1 million tokens
    18
  );
  await tokenA.waitForDeployment();
  console.log("Token A deployed to:", await tokenA.getAddress());

  // Deploy Token B
  const TokenB = await hre.ethers.getContractFactory("Token");
  const tokenB = await TokenB.deploy(
    "Token B",
    "TKNB",
    1000000, // 1 million tokens
    18
  );
  await tokenB.waitForDeployment();
  console.log("Token B deployed to:", await tokenB.getAddress());

  // Deploy DEX
  const DEX = await hre.ethers.getContractFactory("DEX");
  const dex = await DEX.deploy();
  await dex.waitForDeployment();
  console.log("DEX deployed to:", await dex.getAddress());

  console.log("\nDeployment complete!");
  console.log("Update the following addresses in src/App.jsx:");
  console.log(`const DEX_ADDRESS = '${await dex.getAddress()}';`);
  console.log(`const TOKEN_A_ADDRESS = '${await tokenA.getAddress()}';`);
  console.log(`const TOKEN_B_ADDRESS = '${await tokenB.getAddress()}';`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });