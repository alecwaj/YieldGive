import { generateText } from "ai";
import { opusModel } from "../lib/claude.js";
import { unbrowseTool } from "../lib/unbrowse.js";
import {
  getActiveCharities,
  writeReport,
  uploadReportFile,
} from "../lib/supabase.js";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

function getWeekOf(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return d.toISOString().split("T")[0];
}

const REPORTER_SYSTEM_PROMPT = `You are a journalist and analyst writing a weekly Substack post for YieldGive.
YieldGive is a platform connecting crypto yield donors with verified on-chain impact organizations.

Audience: crypto-native readers who care about public goods, impact, and Web3.
Tone: informed, curious, occasionally opinionated. Journalist first, not promotional.

Use unbrowse_fetch to gather fresh information. After research, write a complete Substack draft in Markdown.

Required sections:
## 🌍 This Week in Onchain Impact
[Notable on-chain donation events, milestones, new orgs added to YieldGive database]

## 📡 Landscape Scan
[What's trending in crypto × impact this week — from fresh web sources]

## 🕳️ What's Missing
[Gaps you identify: underserved causes, geographies, types of orgs not represented]

## 🛠️ Requests for Builds
[2–3 specific, concrete project ideas the ecosystem needs]

## 📊 Database Update
[Orgs added/removed this week, current database totals, highlights]

End with a single-sentence call to action to deposit yield on YieldGive.`;

export async function runReporter() {
  console.log("[Reporter] Starting weekly report at", new Date().toISOString());

  const weekOf = getWeekOf();
  const charities = await getActiveCharities();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const recentlyAdded = charities.filter(
    (c) => c.added_at && new Date(c.added_at) > oneWeekAgo
  );

  const contextPrompt = `
Today: ${new Date().toDateString()}
Week of: ${weekOf}

YieldGive database stats:
- Total active charities: ${charities.length}
- Added this week: ${recentlyAdded.length} (${recentlyAdded.map((c) => c.name).join(", ") || "none"})

Research the crypto × impact landscape and write this week's Substack post.
Start with: https://blog.gitcoin.co
Then check Twitter/X for #cryptoforimpact and #publicgoods
Then find any other relevant sources you discover.
`;

  const result = await generateText({
    model: opusModel,
    system: REPORTER_SYSTEM_PROMPT,
    prompt: contextPrompt,
    tools: { unbrowse_fetch: unbrowseTool },
    maxSteps: 20,
    onStepFinish: ({ toolCalls }) => {
      if (toolCalls?.length) {
        console.log("[Reporter] Fetched:", toolCalls.map((t) => (t as any).args?.url).filter(Boolean).join(", "));
      }
    },
  });

  const markdownContent = result.text;
  const filename = `${weekOf}.md`;

  // Save to Supabase
  await writeReport({ week_of: weekOf, markdown_content: markdownContent, status: "draft" });
  await uploadReportFile(filename, markdownContent);

  // Save locally
  const reportsDir = join(process.cwd(), "..", "reports");
  await mkdir(reportsDir, { recursive: true });
  await writeFile(join(reportsDir, filename), markdownContent, "utf-8");

  console.log(`[Reporter] Report saved: reports/${filename}`);
}

runReporter().catch(console.error);
