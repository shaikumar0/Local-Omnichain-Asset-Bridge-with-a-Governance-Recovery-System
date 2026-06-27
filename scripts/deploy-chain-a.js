const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const relayerAddress = process.env.RELAYER_ADDRESS || deployer.address;

  const VaultToken = await hre.ethers.getContractFactory("VaultToken");
  const initialSupply = hre.ethers.parseEther("1000000");
  const vaultToken = await VaultToken.deploy(initialSupply);
  await vaultToken.waitForDeployment();

  const BridgeLock = await hre.ethers.getContractFactory("BridgeLock");
  const bridgeLock = await BridgeLock.deploy(await vaultToken.getAddress());
  await bridgeLock.waitForDeployment();

  const GovernanceEmergency = await hre.ethers.getContractFactory("GovernanceEmergency");
  const governanceEmergency = await GovernanceEmergency.deploy(await bridgeLock.getAddress());
  await governanceEmergency.waitForDeployment();

  const RELAYER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("RELAYER_ROLE"));
  const PAUSER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("PAUSER_ROLE"));

  await (await bridgeLock.grantRole(RELAYER_ROLE, relayerAddress)).wait();
  await (await bridgeLock.grantRole(PAUSER_ROLE, await governanceEmergency.getAddress())).wait();
  await (await governanceEmergency.grantRole(RELAYER_ROLE, relayerAddress)).wait();

  const output = {
    chain: "chainA",
    deployer: deployer.address,
    relayer: relayerAddress,
    vaultToken: await vaultToken.getAddress(),
    bridgeLock: await bridgeLock.getAddress(),
    governanceEmergency: await governanceEmergency.getAddress()
  };

  const outputPath = path.join(__dirname, "..", "deployments", "chain-a.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log("Chain A deployed:", output);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
