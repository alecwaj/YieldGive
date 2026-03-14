# 02 — Smart Contracts

## Toolchain

- **Framework:** Foundry (`forge`, `cast`, `anvil`)
- **Language:** Solidity ^0.8.20
- **Network:** Base Sepolia (testnet) / Base (mainnet)
- **USDC address (Base Sepolia):** `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **Morpho Blue (Base):** `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`

---

## ILendingAdapter.sol

```
contracts/src/interfaces/ILendingAdapter.sol
```

The protocol abstraction layer. All yield protocols implement this interface.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILendingAdapter {
    /// @notice Deposit `amount` of USDC into the protocol
    /// @param amount Amount of USDC (6 decimals) to deposit
    function deposit(uint256 amount) external;

    /// @notice Withdraw `amount` of USDC from the protocol
    /// @param amount Amount of USDC to withdraw
    function withdraw(uint256 amount) external;

    /// @notice Return current balance of USDC + accrued yield for `account`
    /// @param account The address whose balance to check
    function getBalance(address account) external view returns (uint256);

    /// @notice Return only the yield accrued above `principal`
    /// @param account The address to check
    /// @param principal The original deposit amount
    function getYieldAccrued(address account, uint256 principal) external view returns (uint256);

    /// @notice Human-readable protocol name, e.g. "Morpho Blue"
    function protocolName() external pure returns (string memory);
}
```

---

## MorphoAdapter.sol

```
contracts/src/adapters/MorphoAdapter.sol
```

Wraps Morpho Blue's supply/withdraw/balance functions.

**State variables:**
```solidity
IERC20 public immutable usdc;          // USDC token
IMorpho public immutable morpho;        // Morpho Blue core contract
MarketId public immutable marketId;     // The USDC/WETH market on Morpho
```

**Constructor:**
```solidity
constructor(address _morpho, address _usdc, MarketId _marketId)
```

**Key implementation notes:**
- `deposit(uint256 amount)`: calls `morpho.supply(marketParams, amount, 0, address(this), "")` — supplies USDC to Morpho market, receives shares
- `withdraw(uint256 amount)`: calls `morpho.withdraw(marketParams, amount, 0, address(this), address(this))` — redeems shares for USDC
- `getBalance(address account)`: returns `morpho.expectedSupplyAssets(marketParams, address(this))` — includes accrued interest
- `getYieldAccrued(address account, uint256 principal)`: returns `getBalance(account) - principal` (floor 0)
- `protocolName()`: returns `"Morpho Blue"`

**Morpho Blue interface references:**
- `IMorpho` at `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` (Base)
- Market parameters: `loanToken = USDC`, `collateralToken = WETH`, `oracle`, `irm`, `lltv`
- Use the canonical USDC/WETH market — fetch `marketId` from Morpho's official deployment docs

**Security:**
- Only `YieldVault` (set as owner/authorized caller) can call `deposit`/`withdraw`
- Use `onlyVault` modifier with `require(msg.sender == vault, "not vault")`

---

## YieldVault.sol

```
contracts/src/YieldVault.sol
```

The core user-facing contract. Manages deposits, donation config, and yield distribution.

### State Variables

```solidity
IERC20 public immutable usdc;
ILendingAdapter public adapter;
address public owner;

struct DonationConfig {
    uint256 yieldPct;          // 0–100: percentage of yield to donate
    address[] charities;       // up to 4 charity wallet addresses
    uint256[] weights;         // weights per charity, must sum to 100
}

mapping(address => uint256) public principalSnapshot;   // user → deposited principal
mapping(address => DonationConfig) public donationConfig;
mapping(address => uint256) public lastTrigger;          // user → last donation timestamp
```

### Events

```solidity
event Deposited(address indexed user, uint256 amount);
event Withdrawn(address indexed user, uint256 amount);
event DonationConfigSet(address indexed user, uint256 yieldPct, address[] charities, uint256[] weights);
event DonationExecuted(address indexed user, address indexed charity, uint256 amount, uint256 timestamp);
```

### Functions

#### `deposit(uint256 amount, address _adapter)`
```
- require(amount > 0)
- usdc.transferFrom(msg.sender, address(this), amount)
- usdc.approve(address(adapter), amount)
- adapter.deposit(amount)
- principalSnapshot[msg.sender] += amount
- emit Deposited(msg.sender, amount)
```

#### `withdraw(uint256 amount)`
```
- require(amount <= principalSnapshot[msg.sender], "exceeds principal")
- adapter.withdraw(amount)
- principalSnapshot[msg.sender] -= amount
- usdc.transfer(msg.sender, amount)
- emit Withdrawn(msg.sender, amount)
```

#### `setDonationConfig(uint256 yieldPct, address[] calldata charities, uint256[] calldata weights)`
```
- require(yieldPct <= 100)
- require(charities.length <= 4)
- require(charities.length == weights.length)
- require(sum(weights) == 100)
- donationConfig[msg.sender] = DonationConfig(yieldPct, charities, weights)
- emit DonationConfigSet(msg.sender, yieldPct, charities, weights)
```

#### `triggerWeeklyDonation(address user)`
```
- callable by anyone (Chainlink/Gelato keeper calls this)
- require(block.timestamp >= lastTrigger[user] + 7 days, "too early")
- uint256 yieldAccrued = adapter.getYieldAccrued(user, principalSnapshot[user])
- require(yieldAccrued > 0, "no yield")
- DonationConfig memory config = donationConfig[user]
- require(config.charities.length > 0, "no config")
- uint256 yieldToDonate = (yieldAccrued * config.yieldPct) / 100
- adapter.withdraw(yieldToDonate)
- for (uint i = 0; i < config.charities.length; i++):
    uint256 charityAmount = (yieldToDonate * config.weights[i]) / 100
    usdc.transfer(config.charities[i], charityAmount)
    emit DonationExecuted(user, config.charities[i], charityAmount, block.timestamp)
- lastTrigger[user] = block.timestamp
```

#### `getYieldAccrued(address user)` → `uint256` (view)
```
- return adapter.getYieldAccrued(user, principalSnapshot[user])
```

#### `setAdapter(address newAdapter)` — `onlyOwner`
```
- adapter = ILendingAdapter(newAdapter)
```

### Keeper Condition (for Chainlink/Gelato)

The upkeep condition checked off-chain:
```solidity
function checkUpkeep(address user) external view returns (bool needed) {
    return (
        block.timestamp >= lastTrigger[user] + 7 days &&
        getYieldAccrued(user) > 0 &&
        donationConfig[user].charities.length > 0
    );
}
```

---

## CharityRegistry.sol

```
contracts/src/CharityRegistry.sol
```

On-chain source of truth for approved charities. Operator-controlled.

### Struct

```solidity
struct Charity {
    string name;
    string category;
    address wallet;
    string metadataURI;   // IPFS or Supabase Storage JSON: description, logo, impact summary
    bool active;
    uint256 addedAt;
}
```

### State Variables

```solidity
address public owner;
mapping(address => Charity) public charities;
address[] public charityList;  // ordered list for enumeration
```

### Events

```solidity
event NewCharityAdded(address indexed wallet, string name, string category);
event CharityRemoved(address indexed wallet);
```

### Functions

#### `addCharity(Charity calldata charity)` — `onlyOwner`
```
- require(charity.wallet != address(0))
- require(!charities[charity.wallet].active, "already exists")
- charities[charity.wallet] = Charity({
    name: charity.name,
    category: charity.category,
    wallet: charity.wallet,
    metadataURI: charity.metadataURI,
    active: true,
    addedAt: block.timestamp
  })
- charityList.push(charity.wallet)
- emit NewCharityAdded(charity.wallet, charity.name, charity.category)
```

#### `removeCharity(address wallet)` — `onlyOwner`
```
- require(charities[wallet].active, "not active")
- charities[wallet].active = false
- emit CharityRemoved(wallet)
```

#### `getActiveCharities()` → `Charity[]` (view)
```
- iterate charityList, return all where active == true
```

#### `getCharity(address wallet)` → `Charity` (view)
```
- return charities[wallet]
```

---

## MockYieldVault.sol

```
contracts/src/mocks/MockYieldVault.sol
```

Demo fallback. Identical external interface to `YieldVault.sol`. Simulates 5% APY without any real Morpho integration.

**Yield simulation:**
```solidity
mapping(address => uint256) public principalSnapshot;
mapping(address => uint256) public depositTimestamp;

function getYieldAccrued(address user) public view returns (uint256) {
    uint256 principal = principalSnapshot[user];
    if (principal == 0) return 0;
    uint256 elapsed = block.timestamp - depositTimestamp[user];
    // 5% APY, accrued per second
    // yield = principal * 5% * (elapsed / 365 days)
    return (principal * 5 * elapsed) / (100 * 365 days);
}
```

All other functions (`deposit`, `withdraw`, `setDonationConfig`, `triggerWeeklyDonation`) mirror `YieldVault.sol` but operate on internal mock state instead of Morpho.

---

## Deploy Scripts

### `scripts/deploy.ts`

Deploy order:
1. Deploy `MorphoAdapter` (pass Morpho address, USDC address, marketId)
2. Deploy `YieldVault` (pass USDC address, adapter address)
3. Deploy `CharityRegistry`
4. Write addresses to `.env.local` and `app/lib/contracts.ts`

Target: Base Sepolia
```
RPC: https://sepolia.base.org
Chain ID: 84532
```

### `scripts/registerKeeper.ts`

Register `YieldVault.triggerWeeklyDonation` with Chainlink Automation or Gelato on Base Sepolia.

**Chainlink path:**
- Use Chainlink Automation registry on Base Sepolia
- Upkeep type: Custom Logic
- Register one upkeep per user address, or use a batch keeper that iterates all users

**Gelato path:**
- Use Gelato's `automate` SDK
- Create task: call `triggerWeeklyDonation(user)` when `checkUpkeep(user)` returns true

For the hackathon demo: manually call `triggerWeeklyDonation(user)` from the admin panel if keeper registration is blocked.

---

## Test Coverage Requirements

```
contracts/test/
├── YieldVault.t.sol
│   ├── testDeposit()
│   ├── testWithdraw()
│   ├── testSetDonationConfig()
│   ├── testTriggerWeeklyDonation()
│   ├── testCannotWithdrawMoreThanPrincipal()
│   ├── testCannotTriggerBeforeWeekElapsed()
│   └── testWeightsValidation()
├── CharityRegistry.t.sol
│   ├── testAddCharity()
│   ├── testRemoveCharity()
│   ├── testGetActiveCharities()
│   └── testOnlyOwnerCanAdd()
└── MockYieldVault.t.sol
    ├── testYieldAccrual()
    └── testDonationSplit()
```

Run: `forge test --fork-url https://sepolia.base.org -vvv`

---

## Contract Addresses (fill after deploy)

| Contract | Base Sepolia | Base Mainnet |
|----------|-------------|--------------|
| YieldVault | TBD | TBD |
| CharityRegistry | TBD | TBD |
| MorphoAdapter | TBD | TBD |
| MockYieldVault | TBD | — |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Morpho Blue | — | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` |
