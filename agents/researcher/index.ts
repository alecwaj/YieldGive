import { generateText } from "ai";
import { tool } from "ai";
import { z } from "zod";
import { opusModel } from "../lib/claude.js";
import { unbrowseTool } from "../lib/unbrowse.js";
import { writeToResearchQueue } from "../lib/supabase.js";

const RESEARCHER_SYSTEM_PROMPT = `You are a research agent for YieldGive, a platform connecting crypto yield donors with verified on-chain impact organizations.

Your job: discover on-chain impact organizations and add qualifying ones to the research queue.

For each org you find:
1. Collect: name, website, wallet_address, category, description
2. Use etherscan_verify to confirm on-chain activity within the last 12 months
3. Check for public updates within the last 6 months
4. If the org passes all criteria, use supabase_write to save it

Inclusion criteria (ALL must be true):
- Has a verifiable on-chain wallet address
- At least 1 on-chain transaction in the last 12 months
- Public activity in the last 6 months
- Uses or accepts crypto in some meaningful way

Primary sources to research (in order):
1. Gitcoin Grants — https://grants.gitcoin.co
2. Glodollar — https://www.glodollar.org
3. Giveth — https://giveth.io/projects
4. Karma GAP — https://gap.karmahq.xyz
5. Endaoment — https://app.endaoment.org
6. Autonomously discover more sources

Be thorough. Find at least 20 qualifying orgs across all sources.`;

const etherscanVerifyTool = tool({
  description:
    "Verify on-chain activity for a wallet address on Base. Returns last transaction date and whether it meets the 12-month threshold.",
  parameters: z.object({
    wallet_address: z.string().describe("The 0x wallet address to verify"),
    network: z
      .enum(["base", "ethereum"])
      .default("base")
      .describe("Which network to check"),
  }),
  execute: async ({ wallet_address, network }) => {
    const baseUrl =
      network === "base"
        ? "https://api.basescan.org/api"
        : "https://api.etherscan.io/api";

    const url = `${baseUrl}?module=account&action=txlist&address=${wallet_address}&sort=desc&page=1&offset=1&apikey=${process.env.ETHERSCAN_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "1" || !data.result?.length) {
      return { hasActivity: false, lastTx: null, isRecentEnough: false };
    }

    const lastTx = data.result[0];
    const lastTxDate = new Date(
      parseInt(lastTx.timeStamp) * 1000
    ).toISOString();
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const isRecent = new Date(lastTxDate) > twelveMonthsAgo;

    return { hasActivity: true, isRecentEnough: isRecent, lastTx: lastTxDate };
  },
});

const supabaseWriteTool = tool({
  description:
    "Save a discovered on-chain impact organization to the research queue for scoring.",
  parameters: z.object({
    name: z.string(),
    wallet_address: z.string(),
    category: z.string(),
    website: z.string().optional(),
    description: z.string().optional(),
    last_onchain_tx: z.string().optional(),
    source: z.string(),
  }),
  execute: async (org) => {
    await writeToResearchQueue([
      {
        raw_data: org,
        source: org.source,
        scored: false,
      },
    ]);
    console.log(`[Researcher] Queued: ${org.name}`);
    return { success: true, name: org.name };
  },
});

export async function runResearcher() {
  console.log("[Researcher] Starting run at", new Date().toISOString());

  const result = await generateText({
    model: opusModel,
    system: RESEARCHER_SYSTEM_PROMPT,
    prompt:
      "Begin researching on-chain impact organizations. Start with Gitcoin Grants at https://grants.gitcoin.co",
    tools: {
      unbrowse_fetch: unbrowseTool,
      etherscan_verify: etherscanVerifyTool,
      supabase_write: supabaseWriteTool,
    },
    maxSteps: 50,
    onStepFinish: ({ toolCalls }) => {
      if (toolCalls?.length) {
        console.log(
          `[Researcher] Step: called ${toolCalls.map((t) => t.toolName).join(", ")}`
        );
      }
    },
  });

  console.log("[Researcher] Complete. Steps:", result.steps.length);

  // Trigger Scorer
  if (process.env.RESEARCHER_WEBHOOK_URL) {
    try {
      await fetch(process.env.RESEARCHER_WEBHOOK_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.COOLIFY_WEBHOOK_SECRET ?? ""}`,
        },
      });
      console.log("[Researcher] Scorer webhook triggered");
    } catch (err) {
      console.error("[Researcher] Failed to trigger Scorer webhook:", err);
    }
  }
}

runResearcher().catch(console.error);
