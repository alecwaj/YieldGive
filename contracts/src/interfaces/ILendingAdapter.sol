// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILendingAdapter {
    /// @notice Deposit `amount` of USDC into the protocol
    function deposit(uint256 amount) external;

    /// @notice Withdraw `amount` of USDC from the protocol
    function withdraw(uint256 amount) external;

    /// @notice Return current balance (principal + yield) for `account`
    function getBalance(address account) external view returns (uint256);

    /// @notice Return only yield accrued above `principal`
    function getYieldAccrued(address account, uint256 principal) external view returns (uint256);

    /// @notice Human-readable protocol name
    function protocolName() external pure returns (string memory);
}
