require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

const {
  CHAIN_A_RPC_URL,
  CHAIN_B_RPC_URL,
  DEPLOYER_PRIVATE_KEY
} = process.env;

const accounts = DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [];

module.exports = {
  solidity: "0.8.20",
  networks: {
    chainA: {
      url: CHAIN_A_RPC_URL || "http://127.0.0.1:8545",
      chainId: 1111,
      accounts
    },
    chainB: {
      url: CHAIN_B_RPC_URL || "http://127.0.0.1:9545",
      chainId: 2222,
      accounts
    }
  }
};
