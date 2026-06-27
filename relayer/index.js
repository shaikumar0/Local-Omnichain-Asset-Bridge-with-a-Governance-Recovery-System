const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
require("dotenv").config();

const {
  CHAIN_A_RPC_URL,
  CHAIN_B_RPC_URL,
  DEPLOYER_PRIVATE_KEY,
  CONFIRMATION_DEPTH,
  RELAYER_POLL_INTERVAL_MS,
  DB_PATH,
  CHAIN_A_DEPLOYMENT_PATH,
  CHAIN_B_DEPLOYMENT_PATH
} = process.env;

const confirmationDepth = Number(CONFIRMATION_DEPTH || 3);
const pollIntervalMs = Number(RELAYER_POLL_INTERVAL_MS || 2000);
const dbPath = DB_PATH || path.join(__dirname, "data", "processed_nonces.json");

const bridgeLockAbi = [
  "event Locked(address indexed user, uint256 amount, uint256 nonce)",
  "function unlock(address user, uint256 amount, uint256 nonce)",
  "function paused() view returns (bool)"
];

const governanceEmergencyAbi = [
  "function pauseBridge()",
  "function unpauseBridge()"
];

const bridgeMintAbi = [
  "event Burned(address indexed user, uint256 amount, uint256 nonce)",
  "function mintWrapped(address user, uint256 amount, uint256 nonce)",
  "function burn(uint256 amount)"
];

const governanceVotingAbi = [
  "event ProposalPassed(uint256 proposalId, bytes data)"
];

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadState() {
  if (!fs.existsSync(dbPath)) {
    return {
      processed: {
        lock: {},
        burn: {},
        proposal: {}
      },
      lastScanned: {
        chainA: 0,
        chainB: 0
      }
    };
  }
  return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

function saveState(state) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${dbPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2));
  fs.renameSync(tmpPath, dbPath);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(action, label, retries = 5, delayMs = 1500) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      console.error(`[relayer] ${label} failed (attempt ${attempt}):`, error.message);
      await sleep(delayMs);
    }
  }
  throw lastError;
}

function resolveDeployment(chainPath, fallback) {
  const resolvedPath = chainPath ? path.resolve(chainPath) : null;
  const data = resolvedPath ? loadJson(resolvedPath) : null;
  return data || fallback;
}

async function main() {
  if (!DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY is required");
  }

  const chainADeployment = resolveDeployment(CHAIN_A_DEPLOYMENT_PATH, null);
  const chainBDeployment = resolveDeployment(CHAIN_B_DEPLOYMENT_PATH, null);

  if (!chainADeployment || !chainBDeployment) {
    throw new Error("Deployment files not found. Run deploy scripts first.");
  }

  const providerA = new ethers.JsonRpcProvider(CHAIN_A_RPC_URL || "http://127.0.0.1:8545");
  const providerB = new ethers.JsonRpcProvider(CHAIN_B_RPC_URL || "http://127.0.0.1:9545");
  const walletA = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, providerA);
  const walletB = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, providerB);

  const bridgeLock = new ethers.Contract(chainADeployment.bridgeLock, bridgeLockAbi, walletA);
  const governanceEmergency = new ethers.Contract(
    chainADeployment.governanceEmergency,
    governanceEmergencyAbi,
    walletA
  );
  const bridgeMint = new ethers.Contract(chainBDeployment.bridgeMint, bridgeMintAbi, walletB);
  const governanceVoting = new ethers.Contract(
    chainBDeployment.governanceVoting,
    governanceVotingAbi,
    walletB
  );

  let state = loadState();
  saveState(state);

  async function pollChainA() {
    const latest = await providerA.getBlockNumber();
    const target = Math.max(0, latest - confirmationDepth);
    if (target <= state.lastScanned.chainA) {
      return;
    }

    const fromBlock = state.lastScanned.chainA + 1;
    const events = await bridgeLock.queryFilter("Locked", fromBlock, target);

    for (const event of events) {
      const { user, amount, nonce } = event.args;
      const nonceKey = nonce.toString();
      if (state.processed.lock[nonceKey]) {
        continue;
      }

      await withRetry(
        async () => {
          const tx = await bridgeMint.mintWrapped(user, amount, nonce);
          await tx.wait(1);
        },
        `mintWrapped nonce ${nonceKey}`
      );

      state.processed.lock[nonceKey] = true;
      saveState(state);
      console.log(`[relayer] Minted for lock nonce ${nonceKey}`);
    }

    state.lastScanned.chainA = target;
    saveState(state);
  }

  async function pollChainB() {
    const latest = await providerB.getBlockNumber();
    const target = Math.max(0, latest - confirmationDepth);
    if (target <= state.lastScanned.chainB) {
      return;
    }

    const fromBlock = state.lastScanned.chainB + 1;
    const burnedEvents = await bridgeMint.queryFilter("Burned", fromBlock, target);
    const proposalEvents = await governanceVoting.queryFilter("ProposalPassed", fromBlock, target);

    for (const event of burnedEvents) {
      const { user, amount, nonce } = event.args;
      const nonceKey = nonce.toString();
      if (state.processed.burn[nonceKey]) {
        continue;
      }

      await withRetry(
        async () => {
          const tx = await bridgeLock.unlock(user, amount, nonce);
          await tx.wait(1);
        },
        `unlock nonce ${nonceKey}`
      );

      state.processed.burn[nonceKey] = true;
      saveState(state);
      console.log(`[relayer] Unlocked for burn nonce ${nonceKey}`);
    }

    for (const event of proposalEvents) {
      const { proposalId } = event.args;
      const proposalKey = proposalId.toString();
      if (state.processed.proposal[proposalKey]) {
        continue;
      }

      await withRetry(
        async () => {
          const tx = await governanceEmergency.pauseBridge();
          await tx.wait(1);
        },
        `pauseBridge proposal ${proposalKey}`
      );

      state.processed.proposal[proposalKey] = true;
      saveState(state);
      console.log(`[relayer] Paused bridge for proposal ${proposalKey}`);
    }

    state.lastScanned.chainB = target;
    saveState(state);
  }

  console.log("[relayer] Starting relayer service");
  console.log(`[relayer] Chain A RPC: ${CHAIN_A_RPC_URL || "http://127.0.0.1:8545"}`);
  console.log(`[relayer] Chain B RPC: ${CHAIN_B_RPC_URL || "http://127.0.0.1:9545"}`);
  console.log(`[relayer] DB Path: ${dbPath}`);

  while (true) {
    try {
      await pollChainA();
      await pollChainB();
    } catch (error) {
      console.error("[relayer] poll loop error:", error.message);
    }
    await sleep(pollIntervalMs);
  }
}

main().catch((error) => {
  console.error("[relayer] fatal:", error.message);
  process.exit(1);
});
