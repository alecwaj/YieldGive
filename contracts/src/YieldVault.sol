// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ILendingAdapter} from "./interfaces/ILendingAdapter.sol";
import {IERC20} from "./interfaces/IERC20.sol";

contract YieldVault {
    IERC20 public immutable usdc;
    ILendingAdapter public adapter;
    address public owner;

    struct DonationConfig {
        uint256 yieldPct;
        address[] charities;
        uint256[] weights;
    }

    mapping(address => uint256) public principalSnapshot;
    mapping(address => DonationConfig) public _donationConfig;
    mapping(address => uint256) public lastTrigger;

    // Registered users for keeper iteration
    address[] public registeredUsers;
    mapping(address => bool) public isRegistered;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event DonationConfigSet(address indexed user, uint256 yieldPct, address[] charities, uint256[] weights);
    event DonationExecuted(address indexed user, address indexed charity, uint256 amount, uint256 timestamp);
    event AdapterChanged(address indexed newAdapter);

    modifier onlyOwner() {
        require(msg.sender == owner, "YieldVault: not owner");
        _;
    }

    constructor(address _usdc, address _adapter) {
        usdc = IERC20(_usdc);
        adapter = ILendingAdapter(_adapter);
        owner = msg.sender;
    }

    function deposit(uint256 amount, address _adapter) external {
        require(amount > 0, "YieldVault: zero amount");
        if (_adapter != address(0) && _adapter != address(adapter)) {
            adapter = ILendingAdapter(_adapter);
        }
        usdc.transferFrom(msg.sender, address(this), amount);
        usdc.approve(address(adapter), amount);
        adapter.deposit(amount);
        principalSnapshot[msg.sender] += amount;

        if (!isRegistered[msg.sender]) {
            isRegistered[msg.sender] = true;
            registeredUsers.push(msg.sender);
        }

        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(amount <= principalSnapshot[msg.sender], "YieldVault: exceeds principal");
        adapter.withdraw(amount);
        principalSnapshot[msg.sender] -= amount;
        usdc.transfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function setDonationConfig(
        uint256 yieldPct,
        address[] calldata charities,
        uint256[] calldata weights
    ) external {
        require(yieldPct <= 100, "YieldVault: invalid yieldPct");
        require(charities.length > 0 && charities.length <= 4, "YieldVault: 1-4 charities");
        require(charities.length == weights.length, "YieldVault: length mismatch");
        uint256 total;
        for (uint256 i = 0; i < weights.length; i++) total += weights[i];
        require(total == 100, "YieldVault: weights must sum to 100");

        _donationConfig[msg.sender] = DonationConfig(yieldPct, charities, weights);
        emit DonationConfigSet(msg.sender, yieldPct, charities, weights);
    }

    function donationConfig(address user)
        external
        view
        returns (uint256 yieldPct, address[] memory charities, uint256[] memory weights)
    {
        DonationConfig storage c = _donationConfig[user];
        return (c.yieldPct, c.charities, c.weights);
    }

    function triggerWeeklyDonation(address user) external {
        require(
            block.timestamp >= lastTrigger[user] + 7 days,
            "YieldVault: too early"
        );
        _executeDonation(user);
    }

    function getYieldAccrued(address user) public view returns (uint256) {
        return adapter.getYieldAccrued(user, principalSnapshot[user]);
    }

    function checkUpkeep(address user) external view returns (bool needed) {
        return (
            principalSnapshot[user] > 0 &&
            _donationConfig[user].charities.length > 0 &&
            getYieldAccrued(user) > 0 &&
            block.timestamp >= lastTrigger[user] + 7 days
        );
    }

    function setAdapter(address newAdapter) external onlyOwner {
        adapter = ILendingAdapter(newAdapter);
        emit AdapterChanged(newAdapter);
    }

    function _executeDonation(address user) internal {
        uint256 yieldAccrued = getYieldAccrued(user);
        require(yieldAccrued > 0, "YieldVault: no yield");
        DonationConfig storage config = _donationConfig[user];
        require(config.charities.length > 0, "YieldVault: no config");

        uint256 yieldToDonate = (yieldAccrued * config.yieldPct) / 100;
        if (yieldToDonate == 0) {
            lastTrigger[user] = block.timestamp;
            return;
        }

        adapter.withdraw(yieldToDonate);

        for (uint256 i = 0; i < config.charities.length; i++) {
            uint256 charityAmount = (yieldToDonate * config.weights[i]) / 100;
            if (charityAmount > 0) {
                usdc.transfer(config.charities[i], charityAmount);
                emit DonationExecuted(user, config.charities[i], charityAmount, block.timestamp);
            }
        }

        lastTrigger[user] = block.timestamp;
    }
}
