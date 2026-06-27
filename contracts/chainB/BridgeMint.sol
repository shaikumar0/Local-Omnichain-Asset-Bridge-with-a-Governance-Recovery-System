// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {WrappedVaultToken} from "./WrappedVaultToken.sol";

contract BridgeMint is AccessControl {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    WrappedVaultToken public immutable wrappedToken;
    uint256 public burnNonce;
    mapping(uint256 => bool) public processedMints;

    event Burned(address indexed user, uint256 amount, uint256 nonce);

    constructor(address tokenAddress) {
        wrappedToken = WrappedVaultToken(tokenAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function mintWrapped(address user, uint256 amount, uint256 nonce) external onlyRole(RELAYER_ROLE) {
        require(!processedMints[nonce], "NonceAlreadyProcessed");
        processedMints[nonce] = true;
        wrappedToken.mint(user, amount);
    }

    function burn(uint256 amount) external {
        require(amount > 0, "AmountZero");
        burnNonce += 1;
        wrappedToken.bridgeBurn(msg.sender, amount);
        emit Burned(msg.sender, amount, burnNonce);
    }
}
