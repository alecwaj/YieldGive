# 04 — Chatbot: Charity Recommendation Engine

## Overview

The chatbot lives at `/discover` as a dedicated conversational page. It is not a form — it is a streaming chat interface powered by the Claude API. Its job is to understand a user's values in 3–5 exchanges and recommend 3–4 charities from the curated registry that match.

---

## User Flow

```
1. User navigates to /discover
       │
       ▼
2. Bot sends opening message automatically:
   "Hi! I'm here to help you put your yield to work for causes you care about.
    To get started — what issues or problems in the world matter most to you right now?"
       │
       ▼
3. User responds (free text)
       │
       ▼
4. Bot asks 2–4 follow-up questions (one at a time):
   - "Is there a specific part of the world you feel drawn to support?"
   - "Are you more drawn to orgs working on root causes, or direct hands-on service delivery?"
   - "Is there anything you'd prefer not to fund?" (optional)
       │
       ▼
5. After 3–5 exchanges, bot produces recommendations:
   - Outputs a JSON block (see format below)
   - Frontend parses JSON, renders charity cards in right panel
       │
       ▼
6. User reviews cards, adjusts % weights (must sum to 100)
       │
       ▼
7. "Save & Continue" → saves to Supabase user_configs → redirects to /deposit
```

---

## System Prompt

```
You are a giving advisor for YieldGive, a platform that lets people donate
yield from their crypto savings to verified on-chain impact organizations.
Your job is to have a short, warm conversation to understand what the user
cares about, then recommend 3-4 charities from our curated list that best
match their values.

Be conversational, curious, and concise. Ask one question at a time.
After 3-5 exchanges, you have enough to make recommendations.

When you are ready to make recommendations (after at least 3 user messages),
output a JSON block in this exact format — wrapped in triple backticks with
the json tag:

```json
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
```

Rules for recommendations:
- Only recommend charities from the list provided below
- suggested_pct values must sum to 100
- Provide exactly 3 or 4 recommendations
- Pick the best match, not just alphabetical or score order
- The reason should reference something specific the user said

Available charities (CSV format):
{CHARITY_CSV_CONTENTS}
```

**Template variable:** `{CHARITY_CSV_CONTENTS}` is replaced at request time by fetching `charities.csv` from Supabase Storage (via `getCharityCSV()` utility).

---

## API Route: `POST /api/chat`

**File:** `app/app/api/chat/route.ts`

Full implementation:

```typescript
import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createClient } from '@supabase/supabase-js';

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT_TEMPLATE = `You are a giving advisor for YieldGive...
[full system prompt above]
Available charities (CSV format):
{CHARITY_CSV_CONTENTS}`;

async function getCharityCSV(): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data, error } = await supabase.storage.from('public').download('charities.csv');
  if (error) throw error;
  return data.text();
}

export async function POST(req: Request) {
  const { messages } = await req.json();

  let systemPrompt: string;
  try {
    const csv = await getCharityCSV();
    systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('{CHARITY_CSV_CONTENTS}', csv);
  } catch {
    // fallback: use hardcoded sample CSV if Supabase unavailable
    systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace(
      '{CHARITY_CSV_CONTENTS}',
      FALLBACK_CSV
    );
  }

  const result = await streamText({
    model: anthropic('claude-sonnet-4-5'),
    system: systemPrompt,
    messages,
    maxTokens: 1024,
    temperature: 0.7,
  });

  return result.toDataStreamResponse();
}

// 5 seed charities for fallback
const FALLBACK_CSV = `name,category,wallet,description
Gitcoin,Public Goods Funding,0x...,Funds open source and public goods projects via quadratic funding
GainForest,Climate,0x...,Uses AI and blockchain to monitor rainforest preservation
Endaoment,Donor-Advised Fund,0x...,On-chain donor-advised fund for any 501c3
Giveth,Public Goods,0x...,Zero-fee donation platform for blockchain projects
Karma GAP,Impact Tracking,0x...,On-chain grantee accountability and impact reporting`;
```

**Rate limiting:** Cache the charity CSV in a module-level variable with a 5-minute TTL to avoid repeated Supabase Storage fetches per streaming request.

---

## Frontend: `<CharityBot />` Component

**File:** `app/components/CharityBot.tsx`

```typescript
'use client';
import { useChat } from 'ai/react';
import { useState, useRef, useEffect } from 'react';
import { CharityCard } from './CharityCard';
import type { Recommendation } from '../lib/types';

interface CharityBotProps {
  onConfigSaved: (recs: Recommendation[]) => void;
}

export function CharityBot({ onConfigSaved }: CharityBotProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    initialMessages: [
      {
        id: 'greeting',
        role: 'assistant',
        content: "Hi! I'm here to help you put your yield to work for causes you care about. To get started — what issues or problems in the world matter most to you right now?",
      },
    ],
    onFinish: (message) => {
      // Parse JSON block from assistant response
      const jsonMatch = message.content.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.recommendations) {
            setRecommendations(parsed.recommendations);
            // Initialize weights from suggested_pct
            const initialWeights: Record<string, number> = {};
            parsed.recommendations.forEach((r: Recommendation) => {
              initialWeights[r.wallet] = r.suggested_pct;
            });
            setWeights(initialWeights);
          }
        } catch (e) {
          console.error('Failed to parse recommendations JSON', e);
        }
      }
    },
  });

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const weightsValid = totalWeight === 100;

  async function handleSave() {
    const recsWithWeights = recommendations.map(r => ({
      ...r,
      final_pct: weights[r.wallet],
    }));
    onConfigSaved(recsWithWeights);
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Chat panel */}
      <div className="flex flex-col flex-1 max-w-xl">
        <div className="flex-1 overflow-y-auto space-y-4 p-4">
          {messages.map(m => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`rounded-2xl px-4 py-2 max-w-sm text-sm ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {/* Hide the raw JSON block from display */}
                {m.content.replace(/```json[\s\S]*?```/, '[Recommendations above ↗]')}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-4 py-2 text-sm text-gray-500 animate-pulse">
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {recommendations.length === 0 && (
          <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Type your response..."
              className="flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-blue-600 text-white rounded-xl px-4 py-2 text-sm disabled:opacity-50"
            >
              Send
            </button>
          </form>
        )}
      </div>

      {/* Recommendations panel */}
      {recommendations.length > 0 && (
        <div className="w-80 flex flex-col gap-4">
          <h2 className="font-semibold text-gray-900">Your personalized match</h2>
          {recommendations.map(rec => (
            <CharityCard
              key={rec.wallet}
              name={rec.name}
              category={rec.category}
              wallet={rec.wallet}
              matchReason={rec.reason}
              editable
              weight={weights[rec.wallet]}
              onWeightChange={(pct) => setWeights(w => ({ ...w, [rec.wallet]: pct }))}
            />
          ))}

          <div className={`text-sm font-medium ${weightsValid ? 'text-green-600' : 'text-red-500'}`}>
            Total: {totalWeight}% {weightsValid ? '✓' : '(must equal 100%)'}
          </div>

          <button
            onClick={handleSave}
            disabled={!weightsValid}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-medium disabled:opacity-50"
          >
            Save & Continue to Deposit →
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## Saving Config to Supabase

After "Save & Continue":

```typescript
// app/app/discover/page.tsx
import { createClient } from '@supabase/supabase-js';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';

export default function DiscoverPage() {
  const { user } = usePrivy();
  const router = useRouter();

  async function handleConfigSaved(recs: Recommendation[]) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const charityConfig = recs.map(r => ({
      address: r.wallet,
      name: r.name,
      weight_pct: r.final_pct,
    }));

    await supabase.from('user_configs').upsert({
      privy_user_id: user!.id,
      wallet_address: user!.wallet?.address,
      charities: charityConfig,
      chatbot_summary: recs[0]?.summary ?? '',
      updated_at: new Date().toISOString(),
    });

    router.push('/deposit');
  }

  return <CharityBot onConfigSaved={handleConfigSaved} />;
}
```

---

## Caching Strategy

The charity CSV is injected into the system prompt on every `/api/chat` request. To avoid repeated Supabase Storage downloads:

```typescript
// app/lib/charity-cache.ts
let cachedCSV: string | null = null;
let cacheExpiry: number = 0;

export async function getCharityCSV(): Promise<string> {
  if (cachedCSV && Date.now() < cacheExpiry) return cachedCSV;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data, error } = await supabase.storage.from('public').download('charities.csv');
  if (error) throw error;

  cachedCSV = await data.text();
  cacheExpiry = Date.now() + 5 * 60 * 1000; // 5 minute TTL
  return cachedCSV;
}
```

---

## Fallback: Pre-seeded CSV

Seed `charities.csv` in Supabase Storage before the hackathon with 10–15 real on-chain impact orgs. This ensures the chatbot works from day one regardless of agent pipeline status.

**Minimum CSV schema:**
```csv
name,category,wallet,description,website,last_onchain_tx,total_received_usdc
GainForest,Climate,0x1234...,AI-powered rainforest monitoring and preservation,https://gainforest.earth,2024-11-15,125000
Gitcoin,Public Goods,0x5678...,Quadratic funding for open source and public goods,https://gitcoin.co,2024-12-01,5000000
...
```

---

## Claude API Rate Limit Mitigation

If Claude API rate limits are hit during the demo:

1. Cache the conversation summary + recommendations in `user_configs.chatbot_summary` after first generation
2. On revisit to `/discover`, if `chatbot_summary` exists, skip the conversation and show pre-generated cards
3. Add a "Start fresh" button to clear the cache
