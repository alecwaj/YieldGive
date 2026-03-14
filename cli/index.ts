#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("yieldgive")
  .description("YieldGive CLI — yield-powered charitable giving on Base")
  .version("0.1.0");

// Commands are lazy-loaded to keep startup fast
program
  .command("init")
  .description("Connect a wallet for CLI use")
  .option("--private-key <key>", "Use a raw private key")
  .option("--rpc <url>", "Override RPC URL")
  .action(async (opts) => {
    const { initCommand } = await import("./commands/init.js");
    await initCommand(opts);
  });

program
  .command("deposit")
  .description("Deposit USDC into YieldVault")
  .requiredOption("--amount <number>", "Amount of USDC to deposit")
  .action(async (opts) => {
    const { depositCommand } = await import("./commands/deposit.js");
    await depositCommand(opts);
  });

program
  .command("withdraw")
  .description("Withdraw USDC principal from YieldVault")
  .option("--amount <number>", "Amount to withdraw")
  .option("--all", "Withdraw entire principal")
  .action(async (opts) => {
    const { withdrawCommand } = await import("./commands/withdraw.js");
    await withdrawCommand(opts);
  });

program
  .command("status")
  .description("Show balance, yield, and donation config")
  .action(async () => {
    const { statusCommand } = await import("./commands/status.js");
    await statusCommand();
  });

program
  .command("configure")
  .description("Set yield donation configuration")
  .requiredOption("--yield-pct <number>", "% of yield to donate (0-100)")
  .requiredOption("--charities <addresses>", "Comma-separated charity wallet addresses")
  .requiredOption("--weights <weights>", "Comma-separated weights (must sum to 100)")
  .action(async (opts) => {
    const { configureCommand } = await import("./commands/configure.js");
    await configureCommand(opts);
  });

program
  .command("donate")
  .description("Manually trigger yield distribution")
  .option("--user <address>", "User address (defaults to connected wallet)")
  .action(async (opts) => {
    const { donateCommand } = await import("./commands/donate.js");
    await donateCommand(opts);
  });

program
  .command("charities")
  .description("List active charities from registry")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    const { charitiesCommand } = await import("./commands/charities.js");
    await charitiesCommand(opts);
  });

const agentCmd = program.command("agent").description("Agent management commands");

agentCmd
  .command("run")
  .description("Trigger Researcher agent (operator only)")
  .action(async () => {
    const { agentRunCommand } = await import("./commands/agent.js");
    await agentRunCommand();
  });

agentCmd
  .command("proposals")
  .description("List pending proposals from Scorer agent")
  .action(async () => {
    const { agentProposalsCommand } = await import("./commands/agent.js");
    await agentProposalsCommand();
  });

program.parse();
