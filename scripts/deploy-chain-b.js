const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const relayerAddress = process.env.RELAYER_ADDRESS || deployer.address;
  const minVotes = process.env.MIN_VOTES
    ? BigInt(process.env.MIN_VOTES)
    : hre.ethers.parseEther("1");

  const WrappedVaultToken = await hre.ethers.getContractFactory("WrappedVaultToken");
  const wrappedToken = await WrappedVaultToken.deploy();
  await wrappedToken.waitForDeployment();

  const BridgeMint = await hre.ethers.getContractFactory("BridgeMint");
  const bridgeMint = await BridgeMint.deploy(await wrappedToken.getAddress());
  await bridgeMint.waitForDeployment();

  const GovernanceVoting = await hre.ethers.getContractFactory("GovernanceVoting");
  const governanceVoting = await GovernanceVoting.deploy(await wrappedToken.getAddress(), minVotes);
  await governanceVoting.waitForDeployment();

  const MINTER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MINTER_ROLE"));
  const RELAYER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("RELAYER_ROLE"));

  await (await wrappedToken.grantRole(MINTER_ROLE, await bridgeMint.getAddress())).wait();
  await (await bridgeMint.grantRole(RELAYER_ROLE, relayerAddress)).wait();

  const output = {
    chain: "chainB",
    deployer: deployer.address,
    relayer: relayerAddress,
    wrappedToken: await wrappedToken.getAddress(),
    bridgeMint: await bridgeMint.getAddress(),
    governanceVoting: await governanceVoting.getAddress()
  };

  const outputPath = path.join(__dirname, "..", "deployments", "chain-b.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log("Chain B deployed:", output);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
