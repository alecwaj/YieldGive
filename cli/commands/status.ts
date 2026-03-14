import { formatUnits } from "viem";
import chalk from "chalk";
import ora from "ora";
import { getClients } from "../utils/wallet.js";

// Inline ABI to avoid import issues
const VAULT_ABI = [
  { name: "getYieldAccrued", type: "function", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "principalSnapshot", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "lastTrigger", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "donationConfig", type: "function", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ name: "yieldPct", type: "uint256" }, { name: "charities", type: "address[]" }, { name: "weights", type: "uint256[]" }] },
] as const;

const VAULT_ADDRESS = (process.env.YIELD_VAULT_ADDRESS ?? process.env.NEXT_PUBLIC_MOCK_YIELD_VAULT_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;

export async function statusCommand() {
  const spinner = ora("Fetching status...").start();
  try {
    const { account, publicClient } = getClients();

    const [yieldAccrued, principal, lastTrigger, config] = await Promise.all([
      publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "getYieldAccrued", args: [account.address] }),
      publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "principalSnapshot", args: [account.address] }),
      publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "lastTrigger", args: [account.address] }),
      publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "donationConfig", args: [account.address] }),
    ]);

    spinner.stop();

    const nextDonation = new Date((Number(lastTrigger) + 7 * 24 * 60 * 60) * 1000);
    const daysLeft = Math.max(0, Math.ceil((nextDonation.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

    console.log(chalk.bold(`\nYieldGive Status for ${account.address}`));
    console.log("─".repeat(50));
    console.log(`Principal deposited:  ${chalk.bold("$" + formatUnits(principal as bigint, 6))} USDC`);
    console.log(`Yield accrued:        ${chalk.green("$" + Number(formatUnits(yieldAccrued as bigint, 6)).toFixed(6))} USDC`);
    console.log(`Yield % to donate:    ${(config as any)[0]}%`);
    console.log(`Next donation:        in ${daysLeft} days (${nextDonation.toLocaleDateString()})`);

    const charities = (config as any)[1] as string[];
    const weights = (config as any)[2] as bigint[];

    if (charities.length > 0) {
      console.log("\nCharity Allocations:");
      charities.forEach((addr, i) => {
        console.log(`  • ${addr}  ${weights[i]}%`);
      });
    } else {
      console.log(chalk.yellow("\nNo charity config set. Run: yieldgive configure"));
    }
  } catch (err: any) {
    spinner.fail(chalk.red("Failed: " + err.message));
    process.exit(1);
  }
}
