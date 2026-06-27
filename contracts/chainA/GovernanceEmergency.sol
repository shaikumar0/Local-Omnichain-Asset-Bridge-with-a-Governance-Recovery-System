// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {BridgeLock} from "./BridgeLock.sol";

contract GovernanceEmergency is AccessControl {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    BridgeLock public immutable bridgeLock;

    constructor(address bridgeLockAddress) {
        bridgeLock = BridgeLock(bridgeLockAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function pauseBridge() external onlyRole(RELAYER_ROLE) {
        bridgeLock.pause();
    }

    function unpauseBridge() external onlyRole(RELAYER_ROLE) {
        bridgeLock.unpause();
    }
}
