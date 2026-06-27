const { ethers } = require("ethers");
const { expect } = require("chai");
const {
  loadDeployment,
  getProviders,
  getWallet,
  expectRevert,
  chainADeployPath,
  chainBDeployPath
} = require("./helpers");

const bridgeMintAbi = [
  "function mintWrapped(address user, uint256 amount, uint256 nonce)",
  "function processedMints(uint256) view returns (bool)"
];

const bridgeLockAbi = [
  "function unlock(address user, uint256 amount, uint256 nonce)",
  "function processedUnlocks(uint256) view returns (bool)",
  "function lock(uint256 amount)"
];

const vaultAbi = [
  "function approve(address spender, uint256 amount) returns (bool)"
];

describe("Replay protection", function () {
  this.timeout(60000);

  it("reverts on mint replay", async () => {
    const chainB = loadDeployment(chainBDeployPath);
    const { providerB } = getProviders();
    const walletB = getWallet(providerB);

    const bridgeMint = new ethers.Contract(chainB.bridgeMint, bridgeMintAbi, walletB);
    const nonce = 9001;
    const amount = ethers.parseEther("1");

    await (await bridgeMint.mintWrapped(walletB.address, amount, nonce)).wait();
    const error = await expectRevert(bridgeMint.mintWrapped(walletB.address, amount, nonce));
    expect(error).to.be.instanceOf(Error);
  });

  it("reverts on unlock replay", async () => {
    const chainA = loadDeployment(chainADeployPath);
    const { providerA } = getProviders();
    const walletA = getWallet(providerA);

    const bridgeLock = new ethers.Contract(chainA.bridgeLock, bridgeLockAbi, walletA);
    const vaultToken = new ethers.Contract(chainA.vaultToken, vaultAbi, walletA);
    const nonce = 9002;
    const amount = ethers.parseEther("1");

    await (await vaultToken.approve(chainA.bridgeLock, amount)).wait();
    await (await bridgeLock.lock(amount)).wait();
    await (await bridgeLock.unlock(walletA.address, amount, nonce)).wait();
    const error = await expectRevert(bridgeLock.unlock(walletA.address, amount, nonce));
    expect(error).to.be.instanceOf(Error);
  });
});
