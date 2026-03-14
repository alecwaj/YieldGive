// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {YieldVault} from "../src/YieldVault.sol";
import {CharityRegistry} from "../src/CharityRegistry.sol";
import {MockYieldVault} from "../src/mocks/MockYieldVault.sol";
import {MorphoAdapter} from "../src/adapters/MorphoAdapter.sol";
import {IMorpho} from "../src/adapters/MorphoAdapter.sol";

contract Deploy is Script {
    // Base Sepolia USDC
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    // Morpho Blue on Base (mainnet) — replace with Sepolia address when available
    address constant MORPHO = 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy MockYieldVault (demo fallback)
        MockYieldVault mockVault = new MockYieldVault(USDC);
        console.log("MockYieldVault:", address(mockVault));

        // 2. Deploy CharityRegistry
        CharityRegistry registry = new CharityRegistry();
        console.log("CharityRegistry:", address(registry));

        // 3. Deploy MorphoAdapter (skip if Morpho not available on testnet)
        // IMorpho.MarketParams memory params = IMorpho.MarketParams({
        //     loanToken: USDC,
        //     collateralToken: 0x..., // WETH on Base Sepolia
        //     oracle: 0x...,
        //     irm: 0x...,
        //     lltv: 860000000000000000 // 86%
        // });
        // MorphoAdapter adapter = new MorphoAdapter(MORPHO, USDC, address(0), params);
        // console.log("MorphoAdapter:", address(adapter));

        // 4. Deploy YieldVault pointing to MockYieldVault as adapter placeholder
        // YieldVault vault = new YieldVault(USDC, address(adapter));
        // console.log("YieldVault:", address(vault));

        vm.stopBroadcast();

        console.log("\nAdd to .env.local:");
        console.log("NEXT_PUBLIC_MOCK_YIELD_VAULT_ADDRESS=", address(mockVault));
        console.log("NEXT_PUBLIC_CHARITY_REGISTRY_ADDRESS=", address(registry));
    }
}
