import chalk from "chalk";
import ora from "ora";
import { getClients } from "../utils/wallet.js";

const VAULT_ADDRESS = (process.env.NEXT_PUBLIC_MOCK_YIELD_VAULT_ADDRESS ?? "0x0") as `0x${string}`;

const VAULT_ABI = [
  { name: "triggerWeeklyDonation", type: "function", stateMutability: "nonpayable", inputs: [{ name: "user", type: "address" }], outputs: [] },
] as const;

export async function donateCommand(opts: { user?: string }) {
  const spinner = ora("Triggering donation...").start();
  try {
    const { account, walletClient, publicClient } = getClients();
    const user = (opts.user ?? account.address) as `0x${string}`;

    const tx = await walletClient.writeContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "triggerWeeklyDonation",
      args: [user],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });

    spinner.succeed(chalk.green("Donation triggered"));
    console.log(`Tx: https://sepolia.basescan.org/tx/${tx}`);
  } catch (err: any) {
    spinner.fail(chalk.red("Donation failed: " + err.message));
    process.exit(1);
  }
}
