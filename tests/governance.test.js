const { expect } = require("chai");
const { ethers } = require("ethers");
const {
  loadDeployment,
  getProviders,
  getWallet,
  mineBlocks,
  waitFor,
  expectRevert,
  chainADeployPath,
  chainBDeployPath
} = require("./helpers");

const bridgeLockAbi = [
  "function pause()",
  "function paused() view returns (bool)",
  "function lock(uint256 amount)"
];

const bridgeMintAbi = [
  "function mintWrapped(address user, uint256 amount, uint256 nonce)"
];

const governanceAbi = [
  "function createProposal(bytes data)",
  "function vote(uint256 proposalId)",
  "function execute(uint256 proposalId)",
  "function proposalCount() view returns (uint256)"
];

describe("Governance emergency pause", function () {
  this.timeout(120000);

  it("passes a proposal and pauses the bridge", async () => {
    const chainA = loadDeployment(chainADeployPath);
    const chainB = loadDeployment(chainBDeployPath);

    const { providerA, providerB } = getProviders();
    const walletA = getWallet(providerA);
    const walletB = getWallet(providerB);

    const bridgeLock = new ethers.Contract(chainA.bridgeLock, bridgeLockAbi, walletA);
    const bridgeMint = new ethers.Contract(chainB.bridgeMint, bridgeMintAbi, walletB);
    const governanceVoting = new ethers.Contract(chainB.governanceVoting, governanceAbi, walletB);

    await (await governanceVoting.createProposal("0x")).wait();
    const id = await governanceVoting.proposalCount();

    const amount = ethers.parseEther("1");
    await (await bridgeMint.mintWrapped(walletB.address, amount, 8080)).wait();
    await (await governanceVoting.vote(id)).wait();
    await (await governanceVoting.execute(id)).wait();

    await mineBlocks(providerB, 3);

    await waitFor(async () => {
      const paused = await bridgeLock.paused();
      return paused ? paused : null;
    }, 45000);

    const error = await expectRevert(bridgeLock.lock(ethers.parseEther("1")));
    expect(error).to.be.instanceOf(Error);
  });
});
