import { streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createClient } from "@supabase/supabase-js";

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT_TEMPLATE = `You are a giving advisor for YieldGive, a platform that lets people donate yield from their crypto savings to verified on-chain impact organizations. Your job is to have a short, warm conversation to understand what the user cares about, then recommend 3-4 charities from our curated list that best match their values.

Be conversational, curious, and concise. Ask one question at a time. After 3-5 exchanges, you have enough to make recommendations.

When you are ready to make recommendations (after at least 3 user messages), output a JSON block in this exact format — wrapped in triple backticks with the json tag:

\`\`\`json
{
  "recommendations": [
    {
      "name": "...",
      "wallet": "0x...",
      "category": "...",
      "reason": "one sentence explaining why this matches the user's stated values",
      "suggested_pct": 40
    }
  ],
  "summary": "One sentence summarizing what you learned about the user's giving values"
}
\`\`\`

Rules:
- Only recommend charities from the list provided below
- suggested_pct values must sum to 100
- Provide exactly 3 or 4 recommendations
- The reason should reference something specific the user said

Available charities (CSV format):
{CHARITY_CSV_CONTENTS}`;

const FALLBACK_CSV = `name,category,wallet_address,description
GainForest,Climate,0x0000000000000000000000000000000000000001,AI-powered rainforest monitoring and preservation
Gitcoin,Public Goods,0x0000000000000000000000000000000000000002,Quadratic funding for open source and public goods
Endaoment,Donor-Advised Fund,0x0000000000000000000000000000000000000003,On-chain donor-advised fund for any 501c3
Giveth,Public Goods,0x0000000000000000000000000000000000000004,Zero-fee crypto donation platform
GlobeIn,Economic Empowerment,0x0000000000000000000000000000000000000005,Fair trade and artisan market with direct crypto payments`;

let cachedCSV: string | null = null;
let cacheExpiry = 0;

async function getCharityCSV(): Promise<string> {
  if (cachedCSV && Date.now() < cacheExpiry) return cachedCSV;
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data, error } = await supabase.storage
      .from("public")
      .download("charities.csv");
    if (error) throw error;
    cachedCSV = await data.text();
    cacheExpiry = Date.now() + 5 * 60 * 1000;
    return cachedCSV;
  } catch {
    return FALLBACK_CSV;
  }
}

export async function POST(req: Request) {
  const { messages } = await req.json();
  const csv = await getCharityCSV();
  const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace(
    "{CHARITY_CSV_CONTENTS}",
    csv
  );

  const result = await streamText({
    model: anthropic("claude-sonnet-4-5"),
    system: systemPrompt,
    messages,
    maxTokens: 1024,
    temperature: 0.7,
  });

  return result.toDataStreamResponse();
}
