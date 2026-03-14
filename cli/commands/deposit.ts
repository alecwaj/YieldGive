import { parseUnits, formatUnits } from "viem";
import chalk from "chalk";
import ora from "ora";
import { getClients } from "../utils/wallet.js";

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;
const VAULT_ADDRESS = (process.env.NEXT_PUBLIC_MOCK_YIELD_VAULT_ADDRESS ?? "0x0") as `0x${string}`;
const ADAPTER_ADDRESS = (process.env.NEXT_PUBLIC_MORPHO_ADAPTER_ADDRESS ?? "0x0") as `0x${string}`;

const ERC20_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

const VAULT_ABI = [
  { name: "deposit", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }, { name: "_adapter", type: "address" }], outputs: [] },
] as const;

export async function depositCommand(opts: { amount: string }) {
  const spinner = ora("Checking USDC balance...").start();
  try {
    const { account, publicClient, walletClient } = getClients();
    const amount = parseUnits(opts.amount, 6);

    const balance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });

    if ((balance as bigint) < amount) {
      spinner.fail(chalk.red(`Insufficient USDC. Have: $${formatUnits(balance as bigint, 6)}, Need: $${opts.amount}`));
      process.exit(1);
    }

    spinner.text = "Approving USDC...";
    const approveTx = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [VAULT_ADDRESS, amount],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });

    spinner.text = "Depositing into YieldVault...";
    const depositTx = await walletClient.writeContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "deposit",
      args: [amount, ADAPTER_ADDRESS],
    });
    await publicClient.waitForTransactionReceipt({ hash: depositTx });

    spinner.succeed(chalk.green(`Deposited $${opts.amount} USDC`));
    console.log(`Tx: https://sepolia.basescan.org/tx/${depositTx}`);
  } catch (err: any) {
    spinner.fail(chalk.red("Deposit failed: " + err.message));
    process.exit(1);
  }
}
