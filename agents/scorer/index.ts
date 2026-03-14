import { generateObject } from "ai";
import { z } from "zod";
import { opusModel } from "../lib/claude.js";
import {
  getUnscoredQueue,
  writeProposal,
  markQueueItemScored,
  getActiveCharities,
  uploadCharitiesCSV,
} from "../lib/supabase.js";

const ScoreSchema = z.object({
  score_breakdown: z.object({
    onchain_activity: z.number().min(0).max(10),
    transparency: z.number().min(0).max(10),
    impact_efficacy: z.number().min(0).max(10),
    crypto_alignment: z.number().min(0).max(10),
  }),
  rationale: z
    .string()
    .describe("One paragraph explaining the score and recommendation"),
  recommendation: z.enum(["Add", "Hold", "Reject"]),
});

const SCORER_PROMPT = (orgData: string) => `
You are a rigorous evaluator of on-chain impact organizations for YieldGive.

Score the following organization on these 4 dimensions (0–10 each):

1. ON-CHAIN ACTIVITY (weight: 30%)
   - Transaction frequency and recency (within 6 months = high score)
   - Diversity of unique donors
   - Consistent on-chain presence

2. TRANSPARENCY (weight: 30%)
   - Publishes public impact reports
   - Open, verifiable financials
   - Specific, falsifiable claims

3. IMPACT EFFICACY (weight: 25%)
   - Clear theory of change
   - Evidence of measurable outcomes
   - Third-party validation or audits

4. CRYPTO ALIGNMENT (weight: 15%)
   - Crypto serves their actual mission (not just payment method)
   - Contributes back to the ecosystem
   - Understands and uses on-chain tools

Score thresholds:
- ≥70: Strong Add
- 60–69: Add (borderline)
- 40–59: Hold (needs human review)
- <40: Reject

Organization data:
${orgData}
`;

async function syncCharitiesCSV() {
  const charities = await getActiveCharities();
  const headers = [
    "name",
    "category",
    "wallet_address",
    "description",
    "website",
    "last_onchain_tx",
    "total_received_usdc",
    "score",
  ];
  const rows = charities.map((c) =>
    [
      c.name,
      c.category,
      c.wallet_address,
      (c.description ?? "").replace(/,/g, ";"),
      c.website ?? "",
      c.last_onchain_tx ?? "",
      c.total_received_usdc ?? "",
      c.score ?? "",
    ].join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  await uploadCharitiesCSV(csv);
  console.log(`[Scorer] CSV synced: ${charities.length} active charities`);
}

export async function runScorer() {
  console.log("[Scorer] Starting run at", new Date().toISOString());
  const queue = await getUnscoredQueue();
  console.log(`[Scorer] ${queue.length} unscored items`);

  for (const item of queue) {
    try {
      const { object: score } = await generateObject({
        model: opusModel,
        schema: ScoreSchema,
        prompt: SCORER_PROMPT(JSON.stringify(item.raw_data, null, 2)),
      });

      const { onchain_activity, transparency, impact_efficacy, crypto_alignment } =
        score.score_breakdown;
      const total = Math.round(
        onchain_activity * 3.0 +
          transparency * 3.0 +
          impact_efficacy * 2.5 +
          crypto_alignment * 1.5
      );

      await writeProposal({
        charity_data: item.raw_data,
        score: total,
        score_breakdown: score.score_breakdown,
        rationale: score.rationale,
        recommendation: score.recommendation,
        status: "pending",
      });

      await markQueueItemScored(item.id!);
      console.log(
        `[Scorer] ${item.raw_data.name}: ${total}/100 → ${score.recommendation}`
      );
    } catch (err) {
      console.error(`[Scorer] Failed to score ${item.raw_data.name}:`, err);
    }
  }

  await syncCharitiesCSV();
  console.log("[Scorer] Run complete");
}

runScorer().catch(console.error);
