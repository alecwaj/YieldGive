import chalk from "chalk";
import ora from "ora";
import { getClients } from "../utils/wallet.js";

const REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_CHARITY_REGISTRY_ADDRESS ?? "0x0") as `0x${string}`;

const REGISTRY_ABI = [
  { name: "getActiveCharities", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "tuple[]", components: [{ name: "name", type: "string" }, { name: "category", type: "string" }, { name: "wallet", type: "address" }, { name: "metadataURI", type: "string" }, { name: "active", type: "bool" }, { name: "addedAt", type: "uint256" }] }] },
] as const;

export async function charitiesCommand(opts: { json?: boolean }) {
  const spinner = ora("Fetching charities...").start();
  try {
    const { publicClient } = getClients();
    const charities = await publicClient.readContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: "getActiveCharities",
    }) as any[];

    spinner.stop();

    if (opts.json) {
      console.log(JSON.stringify(charities, null, 2));
      return;
    }

    console.log(chalk.bold(`\nActive Charities (${charities.length} total)`));
    console.log("─".repeat(70));
    console.log(
      chalk.dim(
        "Name".padEnd(25) + "Category".padEnd(20) + "Wallet"
      )
    );
    charities.forEach((c: any) => {
      console.log(
        c.name.padEnd(25) +
          c.category.padEnd(20) +
          `${c.wallet.slice(0, 6)}...${c.wallet.slice(-4)}`
      );
    });
  } catch (err: any) {
    spinner.fail(chalk.red("Failed: " + err.message));
    process.exit(1);
  }
}
