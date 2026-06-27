// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract BridgeLock is AccessControl, Pausable {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    IERC20 public immutable vaultToken;
    uint256 public lockNonce;
    mapping(uint256 => bool) public processedUnlocks;

    event Locked(address indexed user, uint256 amount, uint256 nonce);

    constructor(address tokenAddress) {
        vaultToken = IERC20(tokenAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function lock(uint256 amount) external whenNotPaused {
        require(amount > 0, "AmountZero");
        lockNonce += 1;
        require(vaultToken.transferFrom(msg.sender, address(this), amount), "TransferFailed");
        emit Locked(msg.sender, amount, lockNonce);
    }

    function unlock(address user, uint256 amount, uint256 nonce) external whenNotPaused onlyRole(RELAYER_ROLE) {
        require(!processedUnlocks[nonce], "NonceAlreadyProcessed");
        processedUnlocks[nonce] = true;
        require(vaultToken.transfer(user, amount), "TransferFailed");
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
