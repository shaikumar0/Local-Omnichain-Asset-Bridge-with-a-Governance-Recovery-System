const { execSync } = require("child_process");

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

run("npx hardhat run scripts/deploy-chain-a.js --network chainA");
run("npx hardhat run scripts/deploy-chain-b.js --network chainB");
