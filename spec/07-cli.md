# 07 — CLI: `npx yieldgive`

## Overview

A Node.js CLI distributed via npm. Operators and power users can interact with YieldGive contracts directly from the terminal without opening the web app.

```
npx yieldgive <command> [options]
```

---

## Setup

**File:** `cli/package.json`

```json
{
  "name": "yieldgive-cli",
  "version": "0.1.0",
  "description": "CLI for YieldGive — yield-powered charitable giving on Base",
  "bin": {
    "yieldgive": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx cli/index.ts"
  },
  "dependencies": {
    "viem": "^2.0.0",
    "commander": "^12.0.0",
    "chalk": "^5.0.0",
    "ora": "^8.0.0",
    "prompts": "^2.4.2",
    "@supabase/supabase-js": "^2.0.0"
  }
}
```

---

## Entry Point

**File:** `cli/index.ts`

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { depositCommand } from './commands/deposit';
import { withdrawCommand } from './commands/withdraw';
import { statusCommand } from './commands/status';
import { configureCommand } from './commands/configure';
import { donateCommand } from './commands/donate';
import { charitiesCommand } from './commands/charities';
import { agentCommand } from './commands/agent';
import { initCommand } from './commands/init';

const program = new Command();

program
  .name('yieldgive')
  .description('YieldGive CLI — yield-powered charitable giving on Base')
  .version('0.1.0');

program.addCommand(initCommand);
program.addCommand(depositCommand);
program.addCommand(withdrawCommand);
program.addCommand(statusCommand);
program.addCommand(configureCommand);
program.addCommand(donateCommand);
program.addCommand(charitiesCommand);
program.addCommand(agentCommand);

program.parse();
```

---

## Commands

### `yieldgive init`

**File:** `cli/commands/init.ts`

Connect a wallet for CLI use.

```
Usage: yieldgive init

Options:
  --private-key <key>   Use a raw private key (stored in ~/.yieldgive/config.json)
  --rpc <url>           Override default Base Sepolia RPC URL
```

**Behavior:**
1. If `--private-key` provided: store in `~/.yieldgive/config.json` (warn about security)
2. Otherwise: prompt user to enter private key interactively (hidden input)
3. Show connected address and ETH/USDC balance
4. Save config: `{ privateKey, rpcUrl, network: 'base-sepolia' }`

```typescript
import { createWalletClient, http, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { homedir } from 'os';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

export function loadConfig() {
  const configPath = path.join(homedir(), '.yieldgive', 'config.json');
  try {
    return JSON.parse(require('fs').readFileSync(configPath, 'utf-8'));
  } catch {
    throw new Error('Not initialized. Run: yieldgive init');
  }
}

export function getClients() {
  const config = loadConfig();
  const account = privateKeyToAccount(config.privateKey as `0x${string}`);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(config.rpcUrl) });
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(config.rpcUrl) });
  return { account, publicClient, walletClient };
}
```

---

### `yieldgive deposit --amount <USDC>`

**File:** `cli/commands/deposit.ts`

```
Usage: yieldgive deposit --amount <number>

Options:
  --amount <number>   Amount of USDC to deposit (e.g. 100 for $100)
  --mock              Use MockYieldVault instead of real YieldVault
```

**Flow:**
1. Load wallet from config
2. Check USDC balance — error if insufficient
3. Approve USDC spend: `usdc.approve(yieldVaultAddress, amount)`
4. Wait for approval tx
5. Call `YieldVault.deposit(amount, morphoAdapterAddress)`
6. Wait for deposit tx
7. Print: tx hash, new principal balance, yield accrued

```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { parseUnits, formatUnits } from 'viem';
import { getClients } from '../utils/wallet';
import { YIELD_VAULT_ADDRESS, MORPHO_ADAPTER_ADDRESS, USDC_ADDRESS, YIELD_VAULT_ABI, ERC20_ABI } from '../utils/contracts';

export const depositCommand = new Command('deposit')
  .description('Deposit USDC into YieldVault')
  .requiredOption('--amount <number>', 'Amount of USDC to deposit')
  .action(async (opts) => {
    const { account, publicClient, walletClient } = getClients();
    const amount = parseUnits(opts.amount, 6); // USDC has 6 decimals

    const spinner = ora('Checking USDC balance...').start();

    const balance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    });

    if (balance < amount) {
      spinner.fail(chalk.red(`Insufficient USDC. Have: $${formatUnits(balance, 6)}, Need: $${opts.amount}`));
      process.exit(1);
    }

    spinner.text = 'Approving USDC...';
    const approveTx = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [YIELD_VAULT_ADDRESS, amount],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });

    spinner.text = 'Depositing into YieldVault...';
    const depositTx = await walletClient.writeContract({
      address: YIELD_VAULT_ADDRESS,
      abi: YIELD_VAULT_ABI,
      functionName: 'deposit',
      args: [amount, MORPHO_ADAPTER_ADDRESS],
    });
    await publicClient.waitForTransactionReceipt({ hash: depositTx });

    spinner.succeed(chalk.green(`Deposited $${opts.amount} USDC`));
    console.log(`Tx: https://sepolia.basescan.org/tx/${depositTx}`);
  });
```

---

### `yieldgive status`

**File:** `cli/commands/status.ts`

```
Usage: yieldgive status
```

**Output:**
```
YieldGive Status for 0xABCD...1234
─────────────────────────────────────
Principal deposited:     $1,000.00 USDC
Yield accrued:           $3.42 USDC
Yield % to donate:       50%
Next donation:           in 4 days (2024-12-22)

Charity Allocations:
  • GainForest       40%   0x1234...
  • Gitcoin          35%   0x5678...
  • Endaoment        25%   0x9abc...
```

---

### `yieldgive configure`

**File:** `cli/commands/configure.ts`

```
Usage: yieldgive configure --yield-pct <N> --charities <addr1,addr2,...> --weights <w1,w2,...>

Options:
  --yield-pct <number>        % of yield to donate (0–100)
  --charities <addresses>     Comma-separated charity wallet addresses (max 4)
  --weights <weights>         Comma-separated % weights matching charities order (must sum to 100)

Example:
  yieldgive configure --yield-pct 50 --charities 0x111,0x222,0x333 --weights 50,30,20
```

**Validation:**
- `weights.length === charities.length`
- `sum(weights) === 100`
- `yieldPct` in range 0–100
- Each address is a valid 0x address

---

### `yieldgive donate`

**File:** `cli/commands/donate.ts`

```
Usage: yieldgive donate [--user <address>]

Options:
  --user <address>   Address to trigger for (defaults to connected wallet)
```

Manually calls `YieldVault.triggerWeeklyDonation(address)`. Used for demo or when keeper is offline.

Prints: amount distributed per charity, tx hash.

---

### `yieldgive charities`

**File:** `cli/commands/charities.ts`

```
Usage: yieldgive charities [--json]

Options:
  --json   Output as JSON instead of table
```

Fetches active charities from `CharityRegistry.getActiveCharities()` and prints a formatted table:

```
Active Charities (12 total)
────────────────────────────────────────────────────────────────
Name                 Category        Score  Wallet
GainForest           Climate         82     0x1234...5678
Gitcoin              Public Goods    91     0xabcd...ef01
Endaoment            DAF             78     0x2345...6789
...
```

---

### `yieldgive withdraw --amount <USDC>`

**File:** `cli/commands/withdraw.ts`

```
Usage: yieldgive withdraw --amount <number>

Options:
  --amount <number>   Amount of USDC to withdraw (from principal only)
  --all               Withdraw entire principal
```

Calls `YieldVault.withdraw(amount)`. Warns user: "This reduces your principal and thus future yield donations."

---

### `yieldgive agent run`

**File:** `cli/commands/agent.ts`

```
Usage: yieldgive agent <subcommand>

Subcommands:
  run           Trigger Researcher agent via Coolify webhook (operator only)
  proposals     List pending proposals from Scorer agent
  sync-csv      Re-sync charities.csv from Supabase database
```

**`agent run`:** POSTs to `RESEARCHER_WEBHOOK_URL` with `COOLIFY_WEBHOOK_SECRET` header.

**`agent proposals`:** Fetches from Supabase `proposals` table, prints table of pending proposals with scores.

**`agent sync-csv`:** Runs `csvSync.ts` to regenerate `charities.csv` from the `charities` table.

---

## Shared CLI Utilities

### `cli/utils/contracts.ts`

```typescript
import { parseAbi } from 'viem';

export const YIELD_VAULT_ADDRESS = process.env.YIELD_VAULT_ADDRESS as `0x${string}` || '0x...';
export const CHARITY_REGISTRY_ADDRESS = process.env.CHARITY_REGISTRY_ADDRESS as `0x${string}` || '0x...';
export const MORPHO_ADAPTER_ADDRESS = process.env.MORPHO_ADAPTER_ADDRESS as `0x${string}` || '0x...';
export const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`; // Base Sepolia

export const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);

// Import full ABIs from contracts/out/ after forge build
export { YIELD_VAULT_ABI } from '../../app/lib/abis/YieldVault';
export { CHARITY_REGISTRY_ABI } from '../../app/lib/abis/CharityRegistry';
```

---

## Publishing to npm (post-hackathon)

```bash
# In cli/package.json, set:
# "main": "./dist/index.js"
# "bin": { "yieldgive": "./dist/index.js" }

npm publish --access public
```

Then: `npx yieldgive init` works for any user.
