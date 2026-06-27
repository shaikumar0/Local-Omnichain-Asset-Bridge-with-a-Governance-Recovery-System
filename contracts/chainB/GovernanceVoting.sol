// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract GovernanceVoting is AccessControl {
    struct Proposal {
        bytes data;
        uint256 votesFor;
        bool executed;
    }

    IERC20 public immutable votingToken;
    uint256 public minVotes;
    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(uint256 indexed proposalId, bytes data);
    event ProposalPassed(uint256 proposalId, bytes data);

    constructor(address tokenAddress, uint256 minVotes_) {
        votingToken = IERC20(tokenAddress);
        minVotes = minVotes_;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setMinVotes(uint256 newMinVotes) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minVotes = newMinVotes;
    }

    function createProposal(bytes calldata data) external returns (uint256) {
        proposalCount += 1;
        proposals[proposalCount] = Proposal({data: data, votesFor: 0, executed: false});
        emit ProposalCreated(proposalCount, data);
        return proposalCount;
    }

    function vote(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposalId > 0 && proposalId <= proposalCount, "InvalidProposal");
        require(!hasVoted[proposalId][msg.sender], "AlreadyVoted");

        uint256 weight = votingToken.balanceOf(msg.sender);
        require(weight > 0, "NoVotingPower");

        hasVoted[proposalId][msg.sender] = true;
        proposal.votesFor += weight;
    }

    function execute(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposalId > 0 && proposalId <= proposalCount, "InvalidProposal");
        require(!proposal.executed, "AlreadyExecuted");
        require(proposal.votesFor >= minVotes, "QuorumNotMet");

        proposal.executed = true;
        emit ProposalPassed(proposalId, proposal.data);
    }
}
