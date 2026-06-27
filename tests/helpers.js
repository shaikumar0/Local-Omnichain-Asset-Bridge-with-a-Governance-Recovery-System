const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
require("dotenv").config();

const chainADeployPath = process.env.CHAIN_A_DEPLOYMENT_PATH || "./deployments/chain-a.json";
const chainBDeployPath = process.env.CHAIN_B_DEPLOYMENT_PATH || "./deployments/chain-b.json";

function loadDeployment(deployPath) {
  const resolved = path.resolve(deployPath);
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function getProviders() {
  const chainAUrl = process.env.CHAIN_A_RPC_URL || "http://127.0.0.1:8545";
  const chainBUrl = process.env.CHAIN_B_RPC_URL || "http://127.0.0.1:9545";
  return {
    providerA: new ethers.JsonRpcProvider(chainAUrl),
    providerB: new ethers.JsonRpcProvider(chainBUrl)
  };
}

function getWallet(provider) {
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY is required");
  }
  return new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
}

async function mineBlocks(provider, count) {
  for (let i = 0; i < count; i += 1) {
    await provider.send("evm_mine", []);
  }
}

async function waitFor(fn, timeoutMs = 30000, intervalMs = 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await fn();
    if (result) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Timeout waiting for condition");
}

async function expectRevert(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected transaction to revert");
}

module.exports = {
  loadDeployment,
  getProviders,
  getWallet,
  mineBlocks,
  waitFor,
  expectRevert,
  chainADeployPath,
  chainBDeployPath
};
