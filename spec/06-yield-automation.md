# 06 — Yield Automation

## Overview

Weekly yield distribution is triggered by a decentralized keeper (Chainlink Automation or Gelato), not a centralized cron. The keeper calls `YieldVault.triggerWeeklyDonation(address user)` for each user whose 7-day window has elapsed and who has accrued yield and a configured charity split.

---

## YieldVault Keeper Interface

### Upkeep Check (off-chain)

The keeper evaluates this condition for each user before calling `triggerWeeklyDonation`:

```solidity
function checkUpkeep(address user) external view returns (bool needed) {
    return (
        principalSnapshot[user] > 0 &&                          // has deposit
        donationConfig[user].charities.length > 0 &&            // has charity config
        getYieldAccrued(user) > 0 &&                            // has accrued yield
        block.timestamp >= lastTrigger[user] + 7 days           // week has elapsed
    );
}
```

### Trigger (on-chain)

```solidity
function triggerWeeklyDonation(address user) external {
    require(block.timestamp >= lastTrigger[user] + 7 days, "too early");
    // ... see smart contracts spec for full implementation
}
```

---

## Option A: Chainlink Automation

### Setup

1. Fund a LINK wallet on Base Sepolia (get test LINK from faucet)
2. Go to `https://automation.chain.link` → Base Sepolia
3. Register new upkeep:
   - **Type:** Custom Logic
   - **Target contract:** `YieldVaultAddress`
   - **Upkeep name:** `YieldGive Weekly Donations`
   - **Gas limit:** 500,000
   - **Starting balance:** 5 LINK

### Batch Keeper Pattern

Since Chainlink runs one upkeep contract, implement a `BatchKeeper.sol` that iterates all registered users:

```solidity
// contracts/src/keepers/BatchKeeper.sol
contract BatchKeeper is AutomationCompatibleInterface {
    YieldVault public immutable vault;
    address[] public registeredUsers;

    function checkUpkeep(bytes calldata)
        external view override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        address[] memory eligible = new address[](registeredUsers.length);
        uint256 count = 0;
        for (uint i = 0; i < registeredUsers.length; i++) {
            if (vault.checkUpkeep(registeredUsers[i])) {
                eligible[count++] = registeredUsers[i];
            }
        }
        upkeepNeeded = count > 0;
        performData = abi.encode(eligible, count);
    }

    function performUpkeep(bytes calldata performData) external override {
        (address[] memory eligible, uint256 count) = abi.decode(performData, (address[], uint256));
        for (uint i = 0; i < count; i++) {
            if (eligible[i] != address(0)) {
                vault.triggerWeeklyDonation(eligible[i]);
            }
        }
    }

    function registerUser(address user) external {
        // onlyOwner or called by YieldVault on first deposit
        registeredUsers.push(user);
    }
}
```

**User registration:** Call `BatchKeeper.registerUser(msg.sender)` from `YieldVault.deposit()`.

---

## Option B: Gelato

### Setup

```typescript
// scripts/registerKeeper.ts
import { GelatoOpsSDK } from '@gelatonetwork/ops-sdk';
import { ethers } from 'ethers';

async function registerGelato() {
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_BASE_RPC_URL);
  const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);

  const gelatoOps = new GelatoOpsSDK(84532, signer); // Base Sepolia chain ID

  // Create resolver-based task
  const { taskId } = await gelatoOps.createTask({
    execAddress: process.env.NEXT_PUBLIC_YIELD_VAULT_ADDRESS!,
    execSelector: '0x...', // triggerWeeklyDonation(address) selector
    resolverAddress: process.env.BATCH_KEEPER_ADDRESS!,
    resolverData: '0x...', // checkUpkeep() selector
    name: 'YieldGive Weekly Donations',
    useTreasury: true,
  });

  console.log('Gelato task registered:', taskId);
}

registerGelato().catch(console.error);
```

---

## Demo Fallback: Manual Trigger

If keeper registration is blocked during the hackathon, trigger donations manually from the admin panel:

```typescript
// In AdminPanel component
const { triggerDonation } = useYieldVault();

async function handleManualTrigger(userAddress: string) {
  // MockYieldVault has forceOverride param to bypass 7-day check
  await triggerDonation(userAddress as `0x${string}`);
}
```

**MockYieldVault** accepts an optional `forceOverride: bool` parameter to bypass the timing check for demo purposes:

```solidity
function triggerWeeklyDonation(address user, bool forceOverride) external {
    if (!forceOverride) {
        require(block.timestamp >= lastTrigger[user] + 7 days, "too early");
    }
    // ... rest of distribution logic
}
```

---

## Events Emitted

Every donation trigger emits one event per charity:

```solidity
event DonationExecuted(
    address indexed user,
    address indexed charity,
    uint256 amount,      // USDC (6 decimals)
    uint256 timestamp
);
```

The frontend `<DonationHistory />` component reads these events via:

```typescript
const logs = await publicClient.getLogs({
  address: YIELD_VAULT_ADDRESS,
  event: parseAbiItem('event DonationExecuted(address indexed user, address indexed charity, uint256 amount, uint256 timestamp)'),
  args: { user: userAddress },
  fromBlock: DEPLOY_BLOCK,
  toBlock: 'latest',
});
```

---

## Cost Estimates

| Keeper | Setup cost | Per-trigger cost |
|--------|-----------|-----------------|
| Chainlink | 5 LINK deposit (~$50) | ~0.01 LINK per upkeep |
| Gelato | ETH deposit for gas | ~$0.01–0.05 gas per call on Base |
| Manual (demo) | 0 | Gas only |

For hackathon demo: use manual trigger. Register keeper post-demo for production demo.
