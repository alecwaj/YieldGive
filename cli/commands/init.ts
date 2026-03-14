import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createPublicClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import chalk from "chalk";

const CONFIG_DIR = join(homedir(), ".yieldgive");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export async function initCommand(opts: {
  privateKey?: string;
  rpc?: string;
}) {
  const privateKey =
    opts.privateKey ??
    process.env.PRIVATE_KEY;

  if (!privateKey) {
    console.error(chalk.red("Error: Provide --private-key <key> or set PRIVATE_KEY env var"));
    process.exit(1);
  }

  const rpcUrl = opts.rpc ?? "https://sepolia.base.org";

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const balance = await publicClient.getBalance({ address: account.address });

  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(
    CONFIG_PATH,
    JSON.stringify({ privateKey, rpcUrl }, null, 2)
  );

  console.log(chalk.green("✓ Wallet initialized"));
  console.log(`  Address: ${chalk.bold(account.address)}`);
  console.log(`  Balance: ${formatUnits(balance, 18)} ETH`);
  console.log(`  Network: Base Sepolia`);
  console.log(`  Config:  ${CONFIG_PATH}`);
  console.log(chalk.yellow("\n  Warning: Private key stored in plaintext. Use env vars in production."));
}
