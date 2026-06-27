# Local Omnichain Asset Bridge with Governance Recovery

This project implements a two-chain asset bridge with a Node.js relayer and cross-chain governance. It runs entirely locally using two Hardhat nodes and Docker Compose.

## Features

- Two independent local chains with distinct chain IDs
- Lock/mint and burn/unlock bridge flows with replay protection
- Relayer with confirmation delay, retry logic, and persistent state
- Cross-chain governance to pause the bridge
- Dockerized environment with health checks
- Integration tests covering end-to-end flows and failure scenarios

## Prerequisites

- Node.js 18+
- Docker and Docker Compose

## Quick Start

1. Copy environment file:

```bash
copy .env.example .env
```

2. Start the full stack:

```bash
docker-compose up --build
```

3. Watch logs for the relayer connecting to both chains and processing events.

## Local Development (without Docker)

1. Install dependencies:

```bash
npm install
```

2. Start two chains in separate terminals:

```bash
npm run node:chain-a
npm run node:chain-b
```

3. Deploy contracts:

```bash
npm run deploy:all
```

4. Start the relayer:

```bash
node relayer/index.js
```

## Tests

Tests require the chains and relayer to be running (use Docker Compose or run locally).

```bash
npm test
```

To run the relayer recovery test (requires Docker):

```bash
set RUN_DOCKER_TESTS=1
npm test
```

## File Layout

- contracts/: Solidity contracts for both chains
- scripts/: Deployment scripts
- relayer/: Node.js relayer service (with Dockerfile)
- tests/: Unit and integration tests
- docker-compose.yml: Orchestrates chain-a, chain-b, deployer, and relayer
- .env.example: Environment variables documentation
- architecture.md: System diagram and flow description
