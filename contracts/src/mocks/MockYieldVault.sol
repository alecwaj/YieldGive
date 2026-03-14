// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "../interfaces/IERC20.sol";

/// @title MockYieldVault
/// @notice Simulates 5% APY yield without real Morpho integration.
///         Identical external interface to YieldVault. Use for demos and tests.
contract MockYieldVault {
    IERC20 public immutable usdc;

    struct DonationConfig {
        uint256 yieldPct;
        address[] charities;
        uint256[] weights;
    }

    mapping(address => uint256) public principalSnapshot;
    mapping(address => uint256) public depositTimestamp;
    mapping(address => DonationConfig) public _donationConfig;
    mapping(address => uint256) public lastTrigger;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event DonationConfigSet(address indexed user, uint256 yieldPct, address[] charities, uint256[] weights);
    event DonationExecuted(address indexed user, address indexed charity, uint256 amount, uint256 timestamp);

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function deposit(uint256 amount, address /*_adapter*/) external {
        require(amount > 0, "MockYieldVault: zero amount");
        usdc.transferFrom(msg.sender, address(this), amount);
        if (principalSnapshot[msg.sender] == 0) {
            depositTimestamp[msg.sender] = block.timestamp;
        }
        principalSnapshot[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(amount <= principalSnapshot[msg.sender], "MockYieldVault: exceeds principal");
        principalSnapshot[msg.sender] -= amount;
        usdc.transfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function setDonationConfig(
        uint256 yieldPct,
        address[] calldata charities,
        uint256[] calldata weights
    ) external {
        require(yieldPct <= 100, "MockYieldVault: invalid yieldPct");
        require(charities.length > 0 && charities.length <= 4, "MockYieldVault: 1-4 charities");
        require(charities.length == weights.length, "MockYieldVault: length mismatch");
        uint256 total;
        for (uint256 i = 0; i < weights.length; i++) total += weights[i];
        require(total == 100, "MockYieldVault: weights must sum to 100");
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

    /// @notice 5% APY simulated yield: principal * 5% * (elapsed / 365 days)
    function getYieldAccrued(address user) public view returns (uint256) {
        uint256 principal = principalSnapshot[user];
        if (principal == 0) return 0;
        uint256 elapsed = block.timestamp - depositTimestamp[user];
        return (principal * 5 * elapsed) / (100 * 365 days);
    }

    /// @param forceOverride Skip the 7-day timing check (for demos)
    function triggerWeeklyDonation(address user, bool forceOverride) external {
        if (!forceOverride) {
            require(block.timestamp >= lastTrigger[user] + 7 days, "MockYieldVault: too early");
        }
        _executeDonation(user);
    }

    /// @notice Standard keeper-compatible signature
    function triggerWeeklyDonation(address user) external {
        require(block.timestamp >= lastTrigger[user] + 7 days, "MockYieldVault: too early");
        _executeDonation(user);
    }

    function checkUpkeep(address user) external view returns (bool) {
        return (
            principalSnapshot[user] > 0 &&
            _donationConfig[user].charities.length > 0 &&
            getYieldAccrued(user) > 0 &&
            block.timestamp >= lastTrigger[user] + 7 days
        );
    }

    /// @notice For demo: set deposit timestamp in the past to simulate elapsed time
    function setDepositTimestamp(address user, uint256 timestamp) external {
        depositTimestamp[user] = timestamp;
    }

    function _executeDonation(address user) internal {
        uint256 yieldAccrued = getYieldAccrued(user);
        require(yieldAccrued > 0, "MockYieldVault: no yield");
        DonationConfig storage config = _donationConfig[user];
        require(config.charities.length > 0, "MockYieldVault: no config");

        uint256 yieldToDonate = (yieldAccrued * config.yieldPct) / 100;

        for (uint256 i = 0; i < config.charities.length; i++) {
            uint256 charityAmount = (yieldToDonate * config.weights[i]) / 100;
            if (charityAmount > 0 && usdc.balanceOf(address(this)) >= charityAmount) {
                usdc.transfer(config.charities[i], charityAmount);
                emit DonationExecuted(user, config.charities[i], charityAmount, block.timestamp);
            }
        }

        lastTrigger[user] = block.timestamp;
    }
}
