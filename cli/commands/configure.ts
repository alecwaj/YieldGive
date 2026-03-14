import chalk from "chalk";
import ora from "ora";
import { getClients } from "../utils/wallet.js";

const VAULT_ADDRESS = (process.env.NEXT_PUBLIC_MOCK_YIELD_VAULT_ADDRESS ?? "0x0") as `0x${string}`;

const VAULT_ABI = [
  { name: "setDonationConfig", type: "function", stateMutability: "nonpayable", inputs: [{ name: "yieldPct", type: "uint256" }, { name: "charities", type: "address[]" }, { name: "weights", type: "uint256[]" }], outputs: [] },
] as const;

export async function configureCommand(opts: {
  yieldPct: string;
  charities: string;
  weights: string;
}) {
  const yieldPct = parseInt(opts.yieldPct);
  const charities = opts.charities.split(",").map((s) => s.trim()) as `0x${string}`[];
  const weights = opts.weights.split(",").map((s) => parseInt(s.trim()));

  if (isNaN(yieldPct) || yieldPct < 0 || yieldPct > 100) {
    console.error(chalk.red("--yield-pct must be 0–100"));
    process.exit(1);
  }
  if (charities.length !== weights.length) {
    console.error(chalk.red("Number of charities must match number of weights"));
    process.exit(1);
  }
  if (charities.length > 4) {
    console.error(chalk.red("Maximum 4 charities"));
    process.exit(1);
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum !== 100) {
    console.error(chalk.red(`Weights must sum to 100 (got ${weightSum})`));
    process.exit(1);
  }

  const spinner = ora("Setting donation config...").start();
  try {
    const { walletClient, publicClient } = getClients();
    const tx = await walletClient.writeContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "setDonationConfig",
      args: [BigInt(yieldPct), charities, weights.map(BigInt)],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });

    spinner.succeed(chalk.green("Donation config set"));
    console.log(`  Yield %: ${yieldPct}%`);
    charities.forEach((addr, i) => console.log(`  ${addr}: ${weights[i]}%`));
    console.log(`  Tx: https://sepolia.basescan.org/tx/${tx}`);
  } catch (err: any) {
    spinner.fail(chalk.red("Configure failed: " + err.message));
    process.exit(1);
  }
}
