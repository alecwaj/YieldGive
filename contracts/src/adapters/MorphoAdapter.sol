// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ILendingAdapter} from "../interfaces/ILendingAdapter.sol";
import {IERC20} from "../interfaces/IERC20.sol";

// Minimal Morpho Blue interface — full ABI at https://github.com/morpho-org/morpho-blue
interface IMorpho {
    struct MarketParams {
        address loanToken;
        address collateralToken;
        address oracle;
        address irm;
        uint256 lltv;
    }

    function supply(
        MarketParams memory marketParams,
        uint256 assets,
        uint256 shares,
        address onBehalf,
        bytes memory data
    ) external returns (uint256 assetsSupplied, uint256 sharesSupplied);

    function withdraw(
        MarketParams memory marketParams,
        uint256 assets,
        uint256 shares,
        address onBehalf,
        address receiver
    ) external returns (uint256 assetsWithdrawn, uint256 sharesWithdrawn);

    function expectedSupplyAssets(MarketParams memory marketParams, address user)
        external
        view
        returns (uint256);
}

contract MorphoAdapter is ILendingAdapter {
    IERC20 public immutable usdc;
    IMorpho public immutable morpho;
    IMorpho.MarketParams public marketParams;
    address public vault;

    modifier onlyVault() {
        require(msg.sender == vault, "MorphoAdapter: not vault");
        _;
    }

    constructor(
        address _morpho,
        address _usdc,
        address _vault,
        IMorpho.MarketParams memory _marketParams
    ) {
        morpho = IMorpho(_morpho);
        usdc = IERC20(_usdc);
        vault = _vault;
        marketParams = _marketParams;
    }

    function deposit(uint256 amount) external override onlyVault {
        usdc.approve(address(morpho), amount);
        morpho.supply(marketParams, amount, 0, address(this), "");
    }

    function withdraw(uint256 amount) external override onlyVault {
        morpho.withdraw(marketParams, amount, 0, address(this), vault);
    }

    function getBalance(address) external view override returns (uint256) {
        return morpho.expectedSupplyAssets(marketParams, address(this));
    }

    function getYieldAccrued(address, uint256 principal) external view override returns (uint256) {
        uint256 balance = morpho.expectedSupplyAssets(marketParams, address(this));
        return balance > principal ? balance - principal : 0;
    }

    function protocolName() external pure override returns (string memory) {
        return "Morpho Blue";
    }
}
