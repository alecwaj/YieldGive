# 05 — Three-Agent System

## Overview

Three autonomous agents run on Hetzner CAX11 (managed by Coolify), each implemented as a **Vercel AI SDK v6 `generateText` loop** using `claude-opus-4-5` with structured tool calls. Unbrowse is the exclusive browser/data layer for all web retrieval.

```
agent-researcher  →  research_queue table
agent-scorer      →  proposals table + charities.csv
agent-reporter    →  reports table + /reports/YYYY-MM-DD.md
```

**Do NOT use LangChain or Hermes Agent.** Use Vercel AI SDK v6 (`ai` npm package) exclusively.

---

## Shared Library: `agents/lib/`

### `agents/lib/types.ts`

```typescript
export interface Charity {
  id?: string;
  name: string;
  category: string;
  wallet_address: string;
  website?: string;
  description?: string;
  logo_url?: string;
  last_onchain_tx?: string;       // ISO date
  last_public_update?: string;    // ISO date
  total_received_usdc?: number;
  score?: number;                 // 0–100
  score_breakdown?: ScoreBreakdown;
  rationale?: string;
  status?: 'active' | 'pending' | 'rejected';
  added_at?: string;
  source?: 'gitcoin' | 'glodollar' | 'giveth' | 'manual' | 'agent';
}

export interface ScoreBreakdown {
  onchain_activity: number;   // 0–10
  transparency: number;        // 0–10
  impact_efficacy: number;     // 0–10
  crypto_alignment: number;    // 0–10
}

export interface Proposal {
  id?: string;
  charity_data: Charity;
  score: number;
  score_breakdown: ScoreBreakdown;
  rationale: string;
  recommendation: 'Add' | 'Hold' | 'Reject';
  status: 'pending' | 'accepted' | 'rejected';
  created_at?: string;
}

export interface ResearchQueueItem {
  id?: string;
  raw_data: Partial<Charity>;
  source: string;
  discovered_at?: string;
  scored: boolean;
}

export interface Report {
  id?: string;
  week_of: string;              // ISO date (Sunday of the week)
  markdown_content: string;
  status: 'draft' | 'published';
  published_url?: string;
  created_at?: string;
}
```

### `agents/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import type { ResearchQueueItem, Proposal, Charity, Report } from './types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function writeToResearchQueue(items: Omit<ResearchQueueItem, 'id'>[]) {
  const { error } = await supabase.from('research_queue').insert(items);
  if (error) throw error;
}

export async function getUnscoredQueue(): Promise<ResearchQueueItem[]> {
  const { data, error } = await supabase
    .from('research_queue')
    .select('*')
    .eq('scored', false);
  if (error) throw error;
  return data ?? [];
}

export async function markQueueItemScored(id: string) {
  await supabase.from('research_queue').update({ scored: true }).eq('id', id);
}

export async function writeProposal(proposal: Omit<Proposal, 'id'>) {
  const { error } = await supabase.from('proposals').insert(proposal);
  if (error) throw error;
}

export async function getActiveCharities(): Promise<Charity[]> {
  const { data, error } = await supabase
    .from('charities')
    .select('*')
    .eq('status', 'active');
  if (error) throw error;
  return data ?? [];
}

export async function upsertCharity(charity: Charity) {
  const { error } = await supabase
    .from('charities')
    .upsert(charity, { onConflict: 'wallet_address' });
  if (error) throw error;
}

export async function writeReport(report: Omit<Report, 'id'>) {
  const { error } = await supabase.from('reports').insert(report);
  if (error) throw error;
}

export async function uploadCharitiesCSV(csvContent: string) {
  const { error } = await supabase.storage
    .from('public')
    .upload('charities.csv', Buffer.from(csvContent), {
      contentType: 'text/csv',
      upsert: true,
    });
  if (error) throw error;
}
```

### `agents/lib/unbrowse.ts`

Wraps Unbrowse as a Vercel AI SDK `tool`:

```typescript
import { tool } from 'ai';
import { z } from 'zod';

const UNBROWSE_API_KEY = process.env.UNBROWSE_API_KEY!;
const UNBROWSE_BASE_URL = 'https://api.unbrowse.ai/v1';

export const unbrowseTool = tool({
  description: 'Fetch structured data from a webpage using the Unbrowse API. Returns page content in structured form. Use this for all web data retrieval — do not use puppeteer or playwright.',
  parameters: z.object({
    url: z.string().describe('Full URL to fetch'),
    extraction_prompt: z.string().describe('What data to extract from the page'),
  }),
  execute: async ({ url, extraction_prompt }) => {
    const response = await fetch(`${UNBROWSE_BASE_URL}/extract`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${UNBROWSE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, prompt: extraction_prompt }),
    });

    if (!response.ok) {
      throw new Error(`Unbrowse API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return data;  // structured extraction result
  },
});
```

### `agents/lib/claude.ts`

```typescript
import { createAnthropic } from '@ai-sdk/anthropic';

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export const opusModel = anthropic('claude-opus-4-5');
```

---

## Agent 1: Researcher

**File:** `agents/researcher/index.ts`
**Schedule:** On-demand (operator webhook) + weekly incremental
**Entry point:** `node agents/researcher/index.ts`

### Responsibility

Discover new on-chain impact organizations not yet in the charity database. Validate each org's on-chain activity. Write results to `research_queue`.

### Sources to Scrape

| Source | URL seed | What to collect |
|--------|----------|-----------------|
| Gitcoin Grants | `https://grants.gitcoin.co` | Grant recipients, wallet addresses, project pages |
| Glodollar | `https://www.glodollar.org` | Grantees, org profiles, wallet addresses |
| Giveth | `https://giveth.io/projects` | Listed projects with on-chain wallets |
| Karma GAP | `https://gap.karmahq.xyz` | Grantee accountability data, impact attestations |
| Endaoment | `https://app.endaoment.org` | On-chain donor-advised fund recipient orgs |
| RetroPGF | `https://retrofunding.optimism.io` | Retroactive PGF recipients |

The agent should also autonomously discover additional sources during its run.

### Inclusion Criteria

An org is added to `research_queue` only if it meets ALL:
1. Has a verifiable on-chain wallet address
2. At least one on-chain transaction within the last 12 months (verified via Etherscan API)
3. Has publicly published information about their work within the last 6 months
4. Accepts or uses crypto in some capacity

### Agent Implementation

**File:** `agents/researcher/agent.ts`

```typescript
import { generateText } from 'ai';
import { opusModel } from '../lib/claude';
import { unbrowseTool } from '../lib/unbrowse';
import { etherscanTool } from './validator';
import { supabaseWriteTool } from './tools/supabase-write';

const RESEARCHER_SYSTEM_PROMPT = `
You are a research agent for YieldGive, a platform that connects crypto yield donors with
verified on-chain impact organizations.

Your job: discover new on-chain impact organizations and add them to the research queue.

Use the unbrowse_fetch tool to retrieve data from web sources. For each org you find:
1. Collect: name, website, wallet address(es), categories, description
2. Use etherscan_verify to confirm on-chain activity within the last 12 months
3. Check for public updates (blog, Twitter, project page) within the last 6 months
4. If the org passes all criteria, use supabase_write_queue to save it

Sources to research (in order):
1. Gitcoin Grants — https://grants.gitcoin.co
2. Glodollar — https://www.glodollar.org
3. Giveth — https://giveth.io/projects
4. Karma GAP — https://gap.karmahq.xyz
5. Then autonomously discover more sources

Inclusion criteria (ALL must be true):
- Has a verifiable on-chain wallet address
- ≥1 on-chain transaction in the last 12 months
- Public activity in the last 6 months
- Uses or accepts crypto

Be thorough. Run for as many steps as needed to find at least 20 qualifying orgs.
`;

export async function runResearcher() {
  console.log('[Researcher] Starting run...');

  const result = await generateText({
    model: opusModel,
    system: RESEARCHER_SYSTEM_PROMPT,
    prompt: 'Begin researching on-chain impact organizations. Start with Gitcoin Grants.',
    tools: {
      unbrowse_fetch: unbrowseTool,
      etherscan_verify: etherscanTool,
      supabase_write_queue: supabaseWriteTool,
    },
    maxSteps: 50,  // allow enough steps for thorough research
    onStepFinish: ({ text, toolCalls, toolResults }) => {
      console.log('[Researcher] Step completed:', {
        hasText: !!text,
        toolCalls: toolCalls?.length ?? 0,
      });
    },
  });

  console.log('[Researcher] Run complete. Steps:', result.steps.length);

  // Trigger Scorer via webhook
  if (process.env.RESEARCHER_WEBHOOK_URL) {
    await fetch(process.env.RESEARCHER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'x-webhook-secret': process.env.COOLIFY_WEBHOOK_SECRET ?? '' },
    });
    console.log('[Researcher] Triggered Scorer via webhook');
  }
}

// Entry point
runResearcher().catch(console.error);
```

### `agents/researcher/validator.ts`

```typescript
import { tool } from 'ai';
import { z } from 'zod';

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY!;

export const etherscanTool = tool({
  description: 'Verify on-chain activity for a wallet address on Base or Ethereum. Returns last transaction date and total transaction count.',
  parameters: z.object({
    wallet_address: z.string().describe('The 0x wallet address to check'),
    network: z.enum(['base', 'ethereum']).default('base').describe('Which network to check'),
  }),
  execute: async ({ wallet_address, network }) => {
    const baseUrl = network === 'base'
      ? 'https://api.basescan.org/api'
      : 'https://api.etherscan.io/api';

    const url = `${baseUrl}?module=account&action=txlist&address=${wallet_address}&sort=desc&page=1&offset=1&apikey=${ETHERSCAN_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== '1' || !data.result?.length) {
      return { hasActivity: false, lastTx: null, txCount: 0 };
    }

    const lastTx = data.result[0];
    const lastTxDate = new Date(parseInt(lastTx.timeStamp) * 1000).toISOString();
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const isRecent = new Date(lastTxDate) > twelveMonthsAgo;

    return {
      hasActivity: true,
      isRecentEnough: isRecent,
      lastTx: lastTxDate,
      txHash: lastTx.hash,
    };
  },
});
```

---

## Agent 2: Scorer / Ranker

**File:** `agents/scorer/index.ts`
**Schedule:** Triggered after each Researcher batch via Coolify webhook
**Entry point:** `node agents/scorer/index.ts`

### Responsibility

Read unscored items from `research_queue`, evaluate each against the rubric, write scored proposals, and sync accepted orgs to `charities.csv`.

### Scoring Rubric

| Dimension | Weight | What to measure |
|-----------|--------|-----------------|
| On-chain activity | 30% | Frequency and recency of transactions; diversity of unique donors |
| Transparency | 30% | Public reporting, verifiable impact claims, open financials |
| Impact efficacy | 25% | Clarity of theory of change, evidence of outcomes, third-party validation |
| Crypto alignment | 15% | Does crypto serve the mission, or is it just a payment method? |

**Scoring scale:** 0–10 per dimension. Weighted total → 0–100.

```
total_score = (onchain * 3.0) + (transparency * 3.0) + (efficacy * 2.5) + (crypto * 1.5)
```

**Thresholds:**
- ≥ 60: recommendation = "Add" → written to proposals + charities (status: pending operator accept)
- 40–59: recommendation = "Hold" → written to proposals only (operator reviews)
- < 40: recommendation = "Reject" → written to proposals (for audit trail)

### Agent Implementation

**File:** `agents/scorer/agent.ts`

```typescript
import { generateText, generateObject } from 'ai';
import { opusModel } from '../lib/claude';
import { z } from 'zod';
import { getUnscoredQueue, writeProposal, markQueueItemScored } from '../lib/supabase';
import { syncCharitiesCSV } from './csvSync';

const ScoreSchema = z.object({
  score_breakdown: z.object({
    onchain_activity: z.number().min(0).max(10),
    transparency: z.number().min(0).max(10),
    impact_efficacy: z.number().min(0).max(10),
    crypto_alignment: z.number().min(0).max(10),
  }),
  rationale: z.string().describe('One paragraph explaining the score'),
  recommendation: z.enum(['Add', 'Hold', 'Reject']),
});

const SCORER_PROMPT_TEMPLATE = `
You are a rigorous evaluator of on-chain impact organizations for YieldGive.

Score the following organization on these dimensions (0–10 each):

1. ON-CHAIN ACTIVITY (weight: 30%)
   - How frequently does the org receive on-chain donations?
   - How diverse is their donor base?
   - Is their on-chain activity recent (within 6 months)?

2. TRANSPARENCY (weight: 30%)
   - Do they publish public impact reports?
   - Are their financials open and verifiable?
   - Do they make specific, verifiable claims?

3. IMPACT EFFICACY (weight: 25%)
   - Is their theory of change clear and credible?
   - Do they have evidence of measurable outcomes?
   - Have they received third-party validation?

4. CRYPTO ALIGNMENT (weight: 15%)
   - Does blockchain/crypto serve their actual mission?
   - Or is it purely a payment method bolted on?
   - Do they contribute back to the crypto/public goods ecosystem?

Organization data:
{ORG_DATA}

Return a structured JSON score.
`;

export async function runScorer() {
  console.log('[Scorer] Starting run...');
  const queue = await getUnscoredQueue();
  console.log(`[Scorer] Found ${queue.length} unscored items`);

  const addedOrgs: any[] = [];

  for (const item of queue) {
    try {
      const prompt = SCORER_PROMPT_TEMPLATE.replace(
        '{ORG_DATA}',
        JSON.stringify(item.raw_data, null, 2)
      );

      const { object: score } = await generateObject({
        model: opusModel,
        schema: ScoreSchema,
        prompt,
      });

      // Calculate weighted total
      const { onchain_activity, transparency, impact_efficacy, crypto_alignment } = score.score_breakdown;
      const total = Math.round(
        (onchain_activity * 3.0) +
        (transparency * 3.0) +
        (impact_efficacy * 2.5) +
        (crypto_alignment * 1.5)
      );

      const proposal = {
        charity_data: item.raw_data,
        score: total,
        score_breakdown: score.score_breakdown,
        rationale: score.rationale,
        recommendation: score.recommendation,
        status: 'pending' as const,
      };

      await writeProposal(proposal);
      await markQueueItemScored(item.id!);

      console.log(`[Scorer] Scored ${item.raw_data.name}: ${total}/100 → ${score.recommendation}`);

      if (score.recommendation === 'Add') {
        addedOrgs.push({ ...item.raw_data, score: total, score_breakdown: score.score_breakdown, rationale: score.rationale, status: 'pending' });
      }
    } catch (err) {
      console.error(`[Scorer] Failed to score ${item.raw_data.name}:`, err);
    }
  }

  // Sync CSV after scoring batch
  await syncCharitiesCSV();
  console.log('[Scorer] CSV synced. Run complete.');
}

runScorer().catch(console.error);
```

### `agents/scorer/csvSync.ts`

```typescript
import { getActiveCharities, uploadCharitiesCSV } from '../lib/supabase';

export async function syncCharitiesCSV() {
  const charities = await getActiveCharities();

  const headers = ['name', 'category', 'wallet_address', 'description', 'website', 'last_onchain_tx', 'total_received_usdc', 'score'];
  const rows = charities.map(c => [
    c.name,
    c.category,
    c.wallet_address,
    (c.description ?? '').replace(/,/g, ';'),  // escape commas
    c.website ?? '',
    c.last_onchain_tx ?? '',
    c.total_received_usdc ?? '',
    c.score ?? '',
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  await uploadCharitiesCSV(csv);
  console.log(`[csvSync] Uploaded charities.csv with ${charities.length} orgs`);
}
```

---

## Agent 3: Reporter

**File:** `agents/reporter/index.ts`
**Schedule:** Every Sunday at 08:00 UTC (Coolify cron: `0 8 * * 0`)
**Entry point:** `node agents/reporter/index.ts`

### Responsibility

Write a weekly Substack draft covering the crypto + impact landscape. Uses Unbrowse for fresh context + Claude for drafting.

### Report Structure

1. **This Week in Onchain Impact** — notable txs, new orgs added to DB, milestone donations
2. **Landscape Scan** — trending in crypto × impact (fresh from Unbrowse)
3. **What's Missing** — gaps the agent identifies (underserved causes, geographies, use cases)
4. **Requests for Builds** — 2–3 specific project ideas to drive innovation
5. **Database Update** — orgs added/removed this week, current DB stats

### Landscape Scan Sources (via Unbrowse)

- Twitter/X: search `#cryptoforimpact`, `#defi philanthropy`, `#onchaingiving`
- Gitcoin blog: `https://blog.gitcoin.co`
- Substack: search for `crypto impact` newsletters
- The Block, Decrypt for relevant news

### Agent Implementation

**File:** `agents/reporter/agent.ts`

```typescript
import { generateText } from 'ai';
import { opusModel } from '../lib/claude';
import { unbrowseTool } from '../lib/unbrowse';
import { getActiveCharities, writeReport, uploadReportFile } from '../lib/supabase';
import { format, startOfWeek } from 'date-fns';

const REPORTER_SYSTEM_PROMPT = `
You are a journalist and analyst writing a weekly Substack post for YieldGive.
YieldGive is a platform connecting crypto yield donors with verified on-chain impact orgs.

Your audience: crypto-native readers who care about public goods, impact, and Web3.
Tone: informed, curious, occasionally opinionated. Not promotional — you're a journalist first.

Use unbrowse_fetch to gather fresh information from relevant sources.
After research, produce a complete Substack draft in Markdown.

Required sections:
## 🌍 This Week in Onchain Impact
[Notable on-chain donation events, milestones, new orgs added to YieldGive]

## 📡 Landscape Scan
[What's trending in crypto × impact this week — pulled fresh from web sources]

## 🕳️ What's Missing
[Gaps you identify: underserved causes, geographies, types of orgs]

## 🛠️ Requests for Builds
[2–3 specific project ideas the ecosystem needs — be concrete]

## 📊 Database Update
[Summary: X orgs added, Y removed, current total, top scoring new additions]

End with a call-to-action to deposit yield on YieldGive.
`;

export async function runReporter() {
  console.log('[Reporter] Starting weekly report...');

  const weekOf = format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd');
  const charities = await getActiveCharities();
  const recentlyAdded = charities.filter(c => {
    if (!c.added_at) return false;
    const addedDate = new Date(c.added_at);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return addedDate > oneWeekAgo;
  });

  const contextPrompt = `
Today is ${new Date().toDateString()}.
Week of: ${weekOf}

Current YieldGive database stats:
- Total active charities: ${charities.length}
- Newly added this week: ${recentlyAdded.length}
- Newly added orgs: ${recentlyAdded.map(c => c.name).join(', ')}

Research the crypto × impact landscape and write this week's Substack post.
Start by fetching the Gitcoin blog, then check Twitter for #cryptoforimpact,
then check any other relevant sources you find.
`;

  const result = await generateText({
    model: opusModel,
    system: REPORTER_SYSTEM_PROMPT,
    prompt: contextPrompt,
    tools: { unbrowse_fetch: unbrowseTool },
    maxSteps: 20,
  });

  const markdownContent = result.text;
  const filename = `${weekOf}.md`;

  // Save to Supabase table
  await writeReport({
    week_of: weekOf,
    markdown_content: markdownContent,
    status: 'draft',
  });

  // Save to Supabase Storage
  await uploadReportFile(filename, markdownContent);

  // Save locally
  const fs = await import('fs/promises');
  await fs.writeFile(`reports/${filename}`, markdownContent, 'utf-8');

  console.log(`[Reporter] Report saved: reports/${filename}`);
}

runReporter().catch(console.error);
```

---

## Agent Coordination: Shared State via Supabase

```
research_queue table
├── Researcher WRITES (new discovered orgs)
└── Scorer READS + marks scored=true

proposals table
├── Scorer WRITES (scored proposals)
└── Admin panel READS + operator accepts/rejects

charities table
├── Scorer WRITES (accepted orgs, status=pending)
├── Admin panel READS (for stats)
└── Reporter READS (for weekly context)

charities.csv (Supabase Storage)
├── Scorer UPDATES (after each batch)
└── Chatbot API READS (inject into system prompt)
└── /api/charities READS (serve to frontend)

reports table + Storage
├── Reporter WRITES
└── Admin panel READS (view draft list)
```

---

## Agent Entry Point Wiring

Each agent is a standalone Node.js process with a simple entry point:

```json
// agents/package.json
{
  "scripts": {
    "researcher": "tsx researcher/index.ts",
    "scorer": "tsx scorer/index.ts",
    "reporter": "tsx reporter/index.ts"
  },
  "dependencies": {
    "ai": "^4.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "@supabase/supabase-js": "^2.0.0",
    "zod": "^3.0.0",
    "date-fns": "^3.0.0",
    "tsx": "^4.0.0"
  }
}
```

Coolify runs each as a separate service with its own process, env vars, and cron schedule.
