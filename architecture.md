# Local Omnichain Asset Bridge Architecture

## High-Level Flow

1. User locks VaultToken on Chain A via BridgeLock.
2. BridgeLock emits Locked event with a unique nonce.
3. Relayer waits for confirmations, then mints WrappedVaultToken on Chain B via BridgeMint.
4. User burns WrappedVaultToken on Chain B via BridgeMint.
5. BridgeMint emits Burned event with a unique nonce.
6. Relayer waits for confirmations, then unlocks VaultToken on Chain A via BridgeLock.
7. Governance proposals on Chain B emit ProposalPassed, which the relayer uses to pause BridgeLock on Chain A.

## Components

- Chain A (Settlement): VaultToken, BridgeLock, GovernanceEmergency
- Chain B (Execution): WrappedVaultToken, BridgeMint, GovernanceVoting
- Relayer: Node.js service listening to events and relaying messages with confirmation delay
- Persistence: JSON file for processed nonces and last scanned blocks
