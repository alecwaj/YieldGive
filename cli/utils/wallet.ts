import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONFIG_PATH = join(homedir(), ".yieldgive", "config.json");

export function loadConfig(): { privateKey: string; rpcUrl: string } {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    throw new Error(
      "Not initialized. Run: yieldgive init\n" +
        "Or set PRIVATE_KEY and RPC_URL environment variables."
    );
  }
}

export function getClients() {
  const config = loadConfig();
  const pk = (process.env.PRIVATE_KEY ?? config.privateKey) as `0x${string}`;
  const rpcUrl = process.env.RPC_URL ?? config.rpcUrl ?? "https://sepolia.base.org";

  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  return { account, publicClient, walletClient };
}
