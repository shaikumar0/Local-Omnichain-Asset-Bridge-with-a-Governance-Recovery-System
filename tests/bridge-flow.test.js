const { expect } = require("chai");
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
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

const bridgeLockAbi = [
  "function lock(uint256 amount)",
  "function paused() view returns (bool)",
  "function lockNonce() view returns (uint256)",
  "function processedUnlocks(uint256) view returns (bool)",
  "function unlock(address user, uint256 amount, uint256 nonce)"
];

const wrappedAbi = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)"
];

const bridgeMintAbi = [
  "function burn(uint256 amount)",
  "function burnNonce() view returns (uint256)",
  "function processedMints(uint256) view returns (bool)",
  "event Burned(address indexed user, uint256 amount, uint256 nonce)"
];

describe("Bridge end-to-end flow", function () {
  this.timeout(120000);

  it("locks on chain A, mints on chain B, burns, and unlocks", async () => {
    const chainA = loadDeployment(chainADeployPath);
    const chainB = loadDeployment(chainBDeployPath);

    const { providerA, providerB } = getProviders();
    const walletA = getWallet(providerA);
    const walletB = getWallet(providerB);

    const vaultToken = new ethers.Contract(chainA.vaultToken, vaultAbi, walletA);
    const bridgeLock = new ethers.Contract(chainA.bridgeLock, bridgeLockAbi, walletA);
    const wrappedToken = new ethers.Contract(chainB.wrappedToken, wrappedAbi, walletB);
    const bridgeMint = new ethers.Contract(chainB.bridgeMint, bridgeMintAbi, walletB);

    const amount = ethers.parseEther("100");

    const preVault = await vaultToken.balanceOf(walletA.address);
    await (await vaultToken.approve(chainA.bridgeLock, amount)).wait();
    await (await bridgeLock.lock(amount)).wait();

    await mineBlocks(providerA, 3);

    await waitFor(async () => {
      const balance = await wrappedToken.balanceOf(walletB.address);
      return balance >= amount ? balance : null;
    }, 45000);

    const postVault = await vaultToken.balanceOf(walletA.address);
    expect(postVault).to.equal(preVault - amount);

    const supply = await wrappedToken.totalSupply();
    const lockBalance = await vaultToken.balanceOf(chainA.bridgeLock);
    expect(lockBalance).to.equal(supply);

    await (await bridgeMint.burn(amount)).wait();
    await mineBlocks(providerB, 3);

    await waitFor(async () => {
      const balance = await vaultToken.balanceOf(walletA.address);
      return balance === preVault ? balance : null;
    }, 45000);

    const postSupply = await wrappedToken.totalSupply();
    const postLockBalance = await vaultToken.balanceOf(chainA.bridgeLock);
    expect(postLockBalance).to.equal(postSupply);
  });
});
