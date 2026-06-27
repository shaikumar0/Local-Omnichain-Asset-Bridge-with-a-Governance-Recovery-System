const { execSync } = require("child_process");
const { ethers } = require("ethers");
const {
  loadDeployment,
  getProviders,
  getWallet,
  mineBlocks,
  waitFor,
  chainADeployPath,
  chainBDeployPath
} = require("./helpers");

const vaultAbi = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)"
];

const bridgeLockAbi = [
  "function lock(uint256 amount)"
];

const wrappedAbi = [
  "function balanceOf(address) view returns (uint256)"
];

describe("Relayer recovery", function () {
  this.timeout(180000);

  it("processes missed events after restart", async function () {
    if (!process.env.RUN_DOCKER_TESTS) {
      this.skip();
    }

    const chainA = loadDeployment(chainADeployPath);
    const chainB = loadDeployment(chainBDeployPath);

    const { providerA, providerB } = getProviders();
    const walletA = getWallet(providerA);
    const walletB = getWallet(providerB);

    const vaultToken = new ethers.Contract(chainA.vaultToken, vaultAbi, walletA);
    const bridgeLock = new ethers.Contract(chainA.bridgeLock, bridgeLockAbi, walletA);
    const wrappedToken = new ethers.Contract(chainB.wrappedToken, wrappedAbi, walletB);

    execSync("docker compose stop relayer", { stdio: "inherit" });

    const amount = ethers.parseEther("10");
    await (await vaultToken.approve(chainA.bridgeLock, amount)).wait();
    await (await bridgeLock.lock(amount)).wait();
    await mineBlocks(providerA, 3);

    execSync("docker compose start relayer", { stdio: "inherit" });

    await waitFor(async () => {
      const balance = await wrappedToken.balanceOf(walletB.address);
      return balance >= amount ? balance : null;
    }, 60000);
  });
});
