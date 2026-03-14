// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {MockYieldVault} from "../src/mocks/MockYieldVault.sol";
import {CharityRegistry} from "../src/CharityRegistry.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";

// Minimal ERC20 mock for testing
contract MockUSDC {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8 public decimals = 6;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockYieldVaultTest is Test {
    MockYieldVault public vault;
    MockUSDC public usdc;

    address alice = makeAddr("alice");
    address charity1 = makeAddr("charity1");
    address charity2 = makeAddr("charity2");

    function setUp() public {
        usdc = new MockUSDC();
        vault = new MockYieldVault(address(usdc));

        // Fund alice with 1000 USDC
        usdc.mint(alice, 1000e6);
        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
    }

    function testDeposit() public {
        vm.prank(alice);
        vault.deposit(500e6, address(0));
        assertEq(vault.principalSnapshot(alice), 500e6);
    }

    function testWithdraw() public {
        vm.prank(alice);
        vault.deposit(1000e6, address(0));

        vm.prank(alice);
        vault.withdraw(400e6);
        assertEq(vault.principalSnapshot(alice), 600e6);
        assertEq(usdc.balanceOf(alice), 400e6);
    }

    function testCannotWithdrawMoreThanPrincipal() public {
        vm.prank(alice);
        vault.deposit(100e6, address(0));

        vm.prank(alice);
        vm.expectRevert("MockYieldVault: exceeds principal");
        vault.withdraw(200e6);
    }

    function testSetDonationConfig() public {
        address[] memory charities = new address[](2);
        charities[0] = charity1;
        charities[1] = charity2;
        uint256[] memory weights = new uint256[](2);
        weights[0] = 60;
        weights[1] = 40;

        vm.prank(alice);
        vault.setDonationConfig(50, charities, weights);

        (uint256 yieldPct,,) = vault.donationConfig(alice);
        assertEq(yieldPct, 50);
    }

    function testWeightsValidation() public {
        address[] memory charities = new address[](2);
        charities[0] = charity1;
        charities[1] = charity2;
        uint256[] memory weights = new uint256[](2);
        weights[0] = 60;
        weights[1] = 30; // doesn't sum to 100

        vm.prank(alice);
        vm.expectRevert("MockYieldVault: weights must sum to 100");
        vault.setDonationConfig(50, charities, weights);
    }

    function testYieldAccrual() public {
        vm.prank(alice);
        vault.deposit(1000e6, address(0));

        // Fast-forward 1 year
        vm.warp(block.timestamp + 365 days);

        uint256 yield = vault.getYieldAccrued(alice);
        // 5% of 1000 USDC = 50 USDC
        assertApproxEqAbs(yield, 50e6, 1e4); // within 0.01 USDC
    }

    function testDonationExecution() public {
        vm.prank(alice);
        vault.deposit(1000e6, address(0));

        // Fund vault for USDC transfers (simulating yield)
        usdc.mint(address(vault), 100e6);

        address[] memory charities = new address[](2);
        charities[0] = charity1;
        charities[1] = charity2;
        uint256[] memory weights = new uint256[](2);
        weights[0] = 60;
        weights[1] = 40;

        vm.prank(alice);
        vault.setDonationConfig(50, charities, weights);

        // Fast-forward 1 year to accrue yield
        vm.warp(block.timestamp + 365 days);
        // Set deposit timestamp back so yield accrues
        vault.setDepositTimestamp(alice, block.timestamp - 365 days);

        // Trigger (force override for tests)
        vault.triggerWeeklyDonation(alice, true);

        // charity1 should have received ~15 USDC (50% yield * 50% config * 60% weight)
        assertGt(usdc.balanceOf(charity1), 0);
        assertGt(usdc.balanceOf(charity2), 0);
    }

    function testCannotTriggerBeforeWeekElapsed() public {
        vm.prank(alice);
        vault.deposit(1000e6, address(0));
        vault.triggerWeeklyDonation(alice, true); // first trigger ok

        vm.expectRevert("MockYieldVault: too early");
        vault.triggerWeeklyDonation(alice); // no override — should fail
    }
}

contract CharityRegistryTest is Test {
    CharityRegistry public registry;
    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address charityWallet = makeAddr("charityWallet");

    function setUp() public {
        vm.prank(owner);
        registry = new CharityRegistry();
    }

    function testAddCharity() public {
        CharityRegistry.Charity memory c = CharityRegistry.Charity({
            name: "Test Charity",
            category: "Climate",
            wallet: charityWallet,
            metadataURI: "ipfs://QmTest",
            active: true,
            addedAt: 0
        });

        vm.prank(owner);
        registry.addCharity(c);

        assertTrue(registry.charities(charityWallet).active);
        assertEq(registry.charities(charityWallet).name, "Test Charity");
    }

    function testOnlyOwnerCanAdd() public {
        CharityRegistry.Charity memory c = CharityRegistry.Charity({
            name: "Test",
            category: "Climate",
            wallet: charityWallet,
            metadataURI: "",
            active: true,
            addedAt: 0
        });

        vm.prank(alice);
        vm.expectRevert("CharityRegistry: not owner");
        registry.addCharity(c);
    }

    function testRemoveCharity() public {
        CharityRegistry.Charity memory c = CharityRegistry.Charity({
            name: "Test",
            category: "Climate",
            wallet: charityWallet,
            metadataURI: "",
            active: true,
            addedAt: 0
        });

        vm.prank(owner);
        registry.addCharity(c);

        vm.prank(owner);
        registry.removeCharity(charityWallet);

        assertFalse(registry.charities(charityWallet).active);
    }

    function testGetActiveCharities() public {
        address wallet2 = makeAddr("wallet2");

        vm.startPrank(owner);
        registry.addCharity(CharityRegistry.Charity("Org 1", "Climate", charityWallet, "", true, 0));
        registry.addCharity(CharityRegistry.Charity("Org 2", "Health", wallet2, "", true, 0));
        registry.removeCharity(charityWallet);
        vm.stopPrank();

        CharityRegistry.Charity[] memory active = registry.getActiveCharities();
        assertEq(active.length, 1);
        assertEq(active[0].name, "Org 2");
    }
}
