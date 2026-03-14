import chalk from "chalk";
import ora from "ora";
import { createClient } from "@supabase/supabase-js";

export async function agentRunCommand() {
  const webhookUrl = process.env.RESEARCHER_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error(chalk.red("RESEARCHER_WEBHOOK_URL not set"));
    process.exit(1);
  }

  const spinner = ora("Triggering Researcher agent...").start();
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.COOLIFY_WEBHOOK_SECRET ?? ""}`,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    spinner.succeed(chalk.green("Researcher agent triggered"));
  } catch (err: any) {
    spinner.fail(chalk.red("Failed: " + err.message));
    process.exit(1);
  }
}

export async function agentProposalsCommand() {
  const spinner = ora("Fetching proposals...").start();
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data, error } = await supabase
      .from("proposals")
      .select("*")
      .eq("status", "pending")
      .order("score", { ascending: false });

    if (error) throw error;

    spinner.stop();

    if (!data || data.length === 0) {
      console.log(chalk.yellow("No pending proposals."));
      return;
    }

    console.log(chalk.bold(`\nPending Proposals (${data.length})`));
    console.log("─".repeat(70));
    data.forEach((p: any) => {
      const scoreColor = p.score >= 70 ? chalk.green : p.score >= 40 ? chalk.yellow : chalk.red;
      console.log(
        `${scoreColor(String(p.score).padStart(3))}  ${p.charity_data?.name?.padEnd(30) ?? "Unknown".padEnd(30)}  ${p.recommendation}`
      );
    });
  } catch (err: any) {
    spinner.fail(chalk.red("Failed: " + err.message));
    process.exit(1);
  }
}
