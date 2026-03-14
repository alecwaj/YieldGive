import { parseUnits, formatUnits } from "viem";
import chalk from "chalk";
import ora from "ora";
import { getClients } from "../utils/wallet.js";

const VAULT_ADDRESS = (process.env.NEXT_PUBLIC_MOCK_YIELD_VAULT_ADDRESS ?? "0x0") as `0x${string}`;

const VAULT_ABI = [
  { name: "withdraw", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { name: "principalSnapshot", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export async function withdrawCommand(opts: { amount?: string; all?: boolean }) {
  const spinner = ora("Fetching principal...").start();
  try {
    const { account, publicClient, walletClient } = getClients();

    const principal = await publicClient.readContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "principalSnapshot",
      args: [account.address],
    }) as bigint;

    const amount = opts.all
      ? principal
      : parseUnits(opts.amount!, 6);

    if (amount > principal) {
      spinner.fail(chalk.red(`Cannot withdraw $${formatUnits(amount, 6)} — principal is only $${formatUnits(principal, 6)}`));
      process.exit(1);
    }

    spinner.text = `Withdrawing $${formatUnits(amount, 6)} USDC...`;
    console.log(chalk.yellow("\n  Warning: Withdrawing reduces future yield donations."));

    const tx = await walletClient.writeContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "withdraw",
      args: [amount],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });

    spinner.succeed(chalk.green(`Withdrew $${formatUnits(amount, 6)} USDC`));
    console.log(`Tx: https://sepolia.basescan.org/tx/${tx}`);
  } catch (err: any) {
    spinner.fail(chalk.red("Withdraw failed: " + err.message));
    process.exit(1);
  }
}
