// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "../interfaces/IERC20.sol";

/// @title MockYieldVault
/// @notice Drop-in replacement for YieldVault that simulates 5% APY without any
///         real lending protocol. Identical external interface to YieldVault.
///
/// Yield model
/// -----------
/// Yield is virtual — computed from elapsed time and principal. Real USDC
/// distributions are paid from a yield reserve: the contract's USDC balance
/// minus total user principal. Fund the reserve via fundYieldReserve() before
/// triggering donations in tests or demos.
///
/// Multi-deposit correctness
/// -------------------------
/// Each deposit/withdrawal calls _snapshotYield() first, which locks in the
/// yield earned on the *current* principal up to this instant, then updates
/// lastAccrualTime. Subsequent yield is computed on the new principal from that
/// point forward. This prevents over-counting when principal changes mid-stream.
///
/// Distribution correctness
/// ------------------------
/// _yieldDistributed[user] tracks how much has already been paid out.
/// getYieldAccrued() returns (total earned) - (already distributed), so each
/// trigger only distributes the *marginal* yield since the last trigger.
///
/// Principal protection
/// --------------------
/// _executeDonation caps yieldToDonate at yieldReserve() = balanceOf(this) -
/// totalPrincipal. Principal is never touched by a donation trigger.
contract MockYieldVault {
    IERC20 public immutable usdc;

    // ── Per-user yield tracking ───────────────────────────────────────────────

    /// @dev Yield accumulated at the last _snapshotYield() checkpoint.
    mapping(address => uint256) internal _yieldCheckpoint;

    /// @dev block.timestamp when _yieldCheckpoint was last updated.
    mapping(address => uint256) public lastAccrualTime;

    /// @dev Total yield already paid out to charities on behalf of this user.
    mapping(address => uint256) internal _yieldDistributed;

    // ── Per-user principal and config ─────────────────────────────────────────

    struct DonationConfig {
        uint256 yieldPct;      // 0–100: fraction of yield to donate
        address[] charities;   // up to 4 recipients
        uint256[] weights;     // per-charity weights, must sum to 100
    }

    /// @notice Principal deposited by each user. Never includes yield.
    mapping(address => uint256) public principalSnapshot;

    mapping(address => DonationConfig) internal _config;

    /// @notice block.timestamp of the last successful donation trigger per user.
    mapping(address => uint256) public lastTrigger;

    // ── Global ────────────────────────────────────────────────────────────────

    /// @notice Sum of all user principals currently deposited.
    uint256 public totalPrincipal;

    // ── Constants ────────────────────────────────────────────────────────────

    /// @dev 5% APY expressed in basis points.
    uint256 internal constant APY_BPS          = 500;
    uint256 internal constant BPS_DENOMINATOR  = 10_000;
    uint256 internal constant SECONDS_PER_YEAR = 365 days;
    uint256 internal constant DONATION_INTERVAL = 7 days;

    // ── Events — identical to YieldVault ─────────────────────────────────────

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event DonationConfigSet(
        address indexed user,
        uint256 yieldPct,
        address[] charities,
        uint256[] weights
    );
    event DonationExecuted(
        address indexed user,
        address indexed charity,
        uint256 amount,
        uint256 timestamp
    );

    /// @dev Emitted when the yield reserve is topped up for demo/test use.
    event YieldReserveFunded(address indexed funder, uint256 amount);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Public interface — matches YieldVault exactly
    // ══════════════════════════════════════════════════════════════════════════

    /// @notice Deposit `amount` of USDC. The `_adapter` argument is accepted for
    ///         interface compatibility but ignored.
    function deposit(uint256 amount, address /* _adapter */) external {
        require(amount > 0, "MockYieldVault: zero amount");

        // Checkpoint yield on current principal before increasing it.
        _snapshotYield(msg.sender);

        usdc.transferFrom(msg.sender, address(this), amount);
        principalSnapshot[msg.sender] += amount;
        totalPrincipal               += amount;

        emit Deposited(msg.sender, amount);
    }

    /// @notice Withdraw up to the caller's deposited principal.
    ///         Yield is not withdrawable — it is distributed to charities.
    function withdraw(uint256 amount) external {
        require(
            amount > 0,
            "MockYieldVault: zero amount"
        );
        require(
            amount <= principalSnapshot[msg.sender],
            "MockYieldVault: exceeds principal"
        );

        // Checkpoint yield on current principal before decreasing it.
        _snapshotYield(msg.sender);

        principalSnapshot[msg.sender] -= amount;
        totalPrincipal                -= amount;
        usdc.transfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Configure what fraction of yield to donate and to which charities.
    ///         Overwrites any previous config for the caller.
    function setDonationConfig(
        uint256 yieldPct,
        address[] calldata charities,
        uint256[] calldata weights
    ) external {
        require(yieldPct <= 100, "MockYieldVault: invalid yieldPct");
        require(
            charities.length >= 1 && charities.length <= 4,
            "MockYieldVault: 1-4 charities required"
        );
        require(
            charities.length == weights.length,
            "MockYieldVault: length mismatch"
        );

        uint256 weightSum;
        for (uint256 i = 0; i < charities.length; i++) {
            require(charities[i] != address(0), "MockYieldVault: zero charity address");
            weightSum += weights[i];
        }
        require(weightSum == 100, "MockYieldVault: weights must sum to 100");

        _config[msg.sender] = DonationConfig(yieldPct, charities, weights);
        emit DonationConfigSet(msg.sender, yieldPct, charities, weights);
    }

    /// @notice Read a user's donation config. Matches YieldVault's public getter.
    function donationConfig(address user)
        external
        view
        returns (
            uint256 yieldPct,
            address[] memory charities,
            uint256[] memory weights
        )
    {
        DonationConfig storage c = _config[user];
        return (c.yieldPct, c.charities, c.weights);
    }

    /// @notice Keeper-compatible trigger. Enforces the 7-day donation interval.
    function triggerWeeklyDonation(address user) external {
        require(
            block.timestamp >= lastTrigger[user] + DONATION_INTERVAL,
            "MockYieldVault: too early"
        );
        _executeDonation(user);
    }

    /// @notice Demo / test variant. Pass forceOverride = true to bypass the
    ///         7-day interval check (e.g., to trigger immediately after deposit).
    function triggerWeeklyDonation(address user, bool forceOverride) external {
        if (!forceOverride) {
            require(
                block.timestamp >= lastTrigger[user] + DONATION_INTERVAL,
                "MockYieldVault: too early"
            );
        }
        _executeDonation(user);
    }

    /// @notice Net yield earned by `user` that has not yet been distributed.
    ///         This is what a donation trigger will have available to work with.
    function getYieldAccrued(address user) public view returns (uint256) {
        uint256 totalEarned = _yieldCheckpoint[user] + _pendingYield(user);
        uint256 distributed = _yieldDistributed[user];
        return totalEarned > distributed ? totalEarned - distributed : 0;
    }

    /// @notice Returns true when calling triggerWeeklyDonation(user) would succeed.
    function checkUpkeep(address user) external view returns (bool) {
        return (
            principalSnapshot[user] > 0 &&
            _config[user].charities.length > 0 &&
            getYieldAccrued(user) > 0 &&
            block.timestamp >= lastTrigger[user] + DONATION_INTERVAL
        );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Mock-only helpers (not on YieldVault)
    // ══════════════════════════════════════════════════════════════════════════

    /// @notice Fund the contract with extra USDC to cover simulated yield payouts.
    ///         In production, yield USDC comes from Morpho interest accrual.
    ///         In this mock it must be provided externally before donations work.
    ///         Anyone can fund; typically the operator does this for demos/tests.
    function fundYieldReserve(uint256 amount) external {
        require(amount > 0, "MockYieldVault: zero amount");
        usdc.transferFrom(msg.sender, address(this), amount);
        emit YieldReserveFunded(msg.sender, amount);
    }

    /// @notice USDC available for yield distribution: balanceOf(this) - totalPrincipal.
    ///         This is the maximum that can be donated across all users right now.
    function yieldReserve() external view returns (uint256) {
        uint256 bal = usdc.balanceOf(address(this));
        return bal > totalPrincipal ? bal - totalPrincipal : 0;
    }

    /// @notice Set `lastAccrualTime` directly so that `getYieldAccrued` returns a
    ///         useful non-zero value after a warp in tests.
    ///
    ///         Usage in tests:
    ///           vault.deposit(amount, address(0));
    ///           vm.warp(block.timestamp + 365 days);
    ///           vault.setDepositTimestamp(user, block.timestamp - 365 days);
    ///           // getYieldAccrued(user) now returns ~5% of amount
    ///
    ///         The checkpoint and distributed counters are also reset so the user
    ///         appears to start fresh from `timestamp`. Only call this in test/demo
    ///         contexts — production would never backdate accrual time.
    function setDepositTimestamp(address user, uint256 timestamp) external {
        require(timestamp <= block.timestamp, "MockYieldVault: future timestamp");
        lastAccrualTime[user]    = timestamp;
        _yieldCheckpoint[user]   = 0;
        _yieldDistributed[user]  = 0;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Internal
    // ══════════════════════════════════════════════════════════════════════════

    /// @dev Yield that has accrued on the current principal since the last snapshot,
    ///      not yet added to _yieldCheckpoint.
    ///      Formula: principal * APY_BPS/BPS_DENOMINATOR * elapsed/SECONDS_PER_YEAR
    function _pendingYield(address user) internal view returns (uint256) {
        uint256 principal = principalSnapshot[user];
        if (principal == 0 || lastAccrualTime[user] == 0) return 0;
        uint256 elapsed = block.timestamp - lastAccrualTime[user];
        return (principal * APY_BPS * elapsed) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);
    }

    /// @dev Lock in pending yield and reset the accrual clock.
    ///      Must be called before any change to principalSnapshot to avoid
    ///      retroactively applying the new principal to elapsed time.
    function _snapshotYield(address user) internal {
        uint256 pending = _pendingYield(user);
        if (pending > 0) {
            _yieldCheckpoint[user] += pending;
        }
        lastAccrualTime[user] = block.timestamp;
    }

    /// @dev Core donation logic. Called by both triggerWeeklyDonation variants.
    ///
    ///      State is updated before external calls (checks-effects-interactions):
    ///        1. Compute amounts
    ///        2. Update _yieldDistributed and lastTrigger
    ///        3. Transfer USDC to charities
    ///
    ///      If yieldToDonate is zero (e.g., trigger called immediately after
    ///      deposit with no time elapsed), we still update lastTrigger so the
    ///      7-day clock starts, but skip transfers and events.
    ///
    ///      If the yield reserve is insufficient to cover the full yieldToDonate,
    ///      the payout is capped at what is available and the remainder stays
    ///      credited to the user for the next trigger.
    function _executeDonation(address user) internal {
        DonationConfig storage config = _config[user];
        require(config.charities.length > 0, "MockYieldVault: no config set");

        uint256 accrued = getYieldAccrued(user);

        // If no yield yet (e.g., same block as deposit), just set lastTrigger
        // so the 7-day interval starts. No revert, no transfers.
        if (accrued == 0 || config.yieldPct == 0) {
            lastTrigger[user] = block.timestamp;
            return;
        }

        uint256 yieldToDonate = (accrued * config.yieldPct) / 100;

        // Cap by the non-principal USDC available in the contract.
        // This guarantees principal is never distributed to charities.
        {
            uint256 bal       = usdc.balanceOf(address(this));
            uint256 available = bal > totalPrincipal ? bal - totalPrincipal : 0;
            if (yieldToDonate > available) {
                yieldToDonate = available;
            }
        }

        // ── Effects ───────────────────────────────────────────────────────────
        // Record as distributed and update the trigger timestamp before any
        // external calls (CEI pattern).
        _yieldDistributed[user] += yieldToDonate;
        lastTrigger[user]        = block.timestamp;

        // ── Interactions ──────────────────────────────────────────────────────
        if (yieldToDonate == 0) {
            // Reserve was empty; state is updated, no transfers.
            return;
        }

        for (uint256 i = 0; i < config.charities.length; i++) {
            uint256 charityAmount = (yieldToDonate * config.weights[i]) / 100;
            if (charityAmount == 0) continue;
            usdc.transfer(config.charities[i], charityAmount);
            emit DonationExecuted(
                user,
                config.charities[i],
                charityAmount,
                block.timestamp
            );
        }
    }
}
