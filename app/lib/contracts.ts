// Fill addresses after running scripts/deploy.ts
export const YIELD_VAULT_ADDRESS = (process.env.NEXT_PUBLIC_YIELD_VAULT_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const MOCK_YIELD_VAULT_ADDRESS = (process.env.NEXT_PUBLIC_MOCK_YIELD_VAULT_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const CHARITY_REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_CHARITY_REGISTRY_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const MORPHO_ADAPTER_ADDRESS = (process.env.NEXT_PUBLIC_MORPHO_ADAPTER_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;

// Base Sepolia USDC
export const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;

// ABIs — copy from contracts/out/ after forge build
// For now, minimal inline ABIs

export const ERC20_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

export const YIELD_VAULT_ABI = [
  { name: "deposit", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }, { name: "_adapter", type: "address" }], outputs: [] },
  { name: "withdraw", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { name: "setDonationConfig", type: "function", stateMutability: "nonpayable", inputs: [{ name: "yieldPct", type: "uint256" }, { name: "charities", type: "address[]" }, { name: "weights", type: "uint256[]" }], outputs: [] },
  { name: "triggerWeeklyDonation", type: "function", stateMutability: "nonpayable", inputs: [{ name: "user", type: "address" }], outputs: [] },
  { name: "getYieldAccrued", type: "function", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "principalSnapshot", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "lastTrigger", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "donationConfig", type: "function", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ name: "yieldPct", type: "uint256" }, { name: "charities", type: "address[]" }, { name: "weights", type: "uint256[]" }] },
  { name: "DonationExecuted", type: "event", inputs: [{ name: "user", type: "address", indexed: true }, { name: "charity", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }, { name: "timestamp", type: "uint256", indexed: false }] },
] as const;

export const CHARITY_REGISTRY_ABI = [
  { name: "getActiveCharities", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "tuple[]", components: [{ name: "name", type: "string" }, { name: "category", type: "string" }, { name: "wallet", type: "address" }, { name: "metadataURI", type: "string" }, { name: "active", type: "bool" }, { name: "addedAt", type: "uint256" }] }] },
  { name: "addCharity", type: "function", stateMutability: "nonpayable", inputs: [{ name: "charity", type: "tuple", components: [{ name: "name", type: "string" }, { name: "category", type: "string" }, { name: "wallet", type: "address" }, { name: "metadataURI", type: "string" }, { name: "active", type: "bool" }, { name: "addedAt", type: "uint256" }] }], outputs: [] },
  { name: "removeCharity", type: "function", stateMutability: "nonpayable", inputs: [{ name: "wallet", type: "address" }], outputs: [] },
  { name: "NewCharityAdded", type: "event", inputs: [{ name: "wallet", type: "address", indexed: true }, { name: "name", type: "string", indexed: false }, { name: "category", type: "string", indexed: false }] },
] as const;
