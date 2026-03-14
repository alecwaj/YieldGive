# 12 — Demo Script (Judge Walkthrough)

## Overview

Target audience: hackathon judges. Assumes 5–10 minutes. Move fast — have everything pre-loaded in browser tabs.

**Pre-demo checklist:**
- [ ] Deploy wallet has USDC + yield already accrued (don't wait for real accrual during demo)
- [ ] Privy account pre-created with embedded wallet
- [ ] MockYieldVault has simulated yield ready to distribute
- [ ] Researcher agent has already run; 12+ orgs in `research_queue`
- [ ] Scorer has already run; 3–4 proposals in admin queue
- [ ] Reporter has generated this week's Substack draft
- [ ] Base Sepolia explorer tabs ready to open
- [ ] All 7 browser tabs pre-opened and loaded

---

## Tab Setup (Pre-Load Before Demo)

| Tab # | URL | Purpose |
|-------|-----|---------|
| 1 | `https://yieldgive.vercel.app` | Landing page |
| 2 | `https://yieldgive.vercel.app/admin` | Admin panel |
| 3 | `https://yieldgive.vercel.app/discover` | Chatbot page |
| 4 | `https://yieldgive.vercel.app/dashboard` | Dashboard |
| 5 | `https://sepolia.basescan.org/address/<YieldVault>` | Contract explorer |
| 6 | `https://sepolia.basescan.org/address/<CharityRegistry>` | Registry explorer |
| 7 | `/reports/2024-12-22.md` (local preview or Supabase Storage URL) | Reporter output |

---

## Opening Statement (30 seconds)

> "Billions of dollars sit in crypto wallets earning yield — and charities struggle every year to prove they're legitimate and find sustainable funding. YieldGive solves both problems at once.
>
> Users deposit into Morpho, earn yield, and that yield is automatically routed to verified on-chain charities they believe in. And behind the scenes, an AI agent system continuously researches, scores, and ranks impact organizations — so the only charities that get access to this yield stream are ones with verifiable on-chain track records.
>
> Let me show you how it works."

---

## Step 1: The Agent Pipeline (~2 minutes)

**Switch to Tab 2 (Admin panel)**

> "Start with what makes YieldGive defensible: our three-agent research pipeline."

1. Show the **Proposals Queue** section
   - Point out: "The Researcher agent scanned Gitcoin Grants and Glodollar this week using Unbrowse — direct API access to real browser sessions, not headless scraping."
   - Show 3–4 pending proposals with score bars

2. Click into one proposal:
   - Show score breakdown: "This org scores 84/100. On-chain activity is an 8 — they've received from 200+ unique donors in the last 6 months. Transparency is a 9 — they publish quarterly impact reports with verifiable on-chain attestations."

3. Click **Accept**:
   - MetaMask pops up → confirm
   - Wait for tx → explorer link appears
   - **Switch to Tab 6 (CharityRegistry explorer)** → refresh → show `NewCharityAdded` event

> "That organization is now live in the registry. Any user whose yield is split to that category will start donating to them next week. The agent enforces the standard — charities have to earn their place here."

---

## Step 2: User Onboarding (~2 minutes)

**Switch to Tab 1 (Landing)**

> "Now let's see the user side."

1. Click "Get Started" → `/onboard`
   - Show Privy login options: "Email, Google, or connect MetaMask. For demo I'll use the pre-authenticated account."
   - Show embedded wallet address in the nav

2. Click to `/onramp`
   - "USDC shows up from Coinbase Pay here — we've already funded the demo wallet."

**Switch to Tab 3 (Discover / Chatbot)**

> "Before depositing, the user talks to our charity recommendation agent."

3. Show the chat interface
   - Type: *"I care most about climate change and economic access in the Global South"*
   - Bot asks a follow-up: *"Are you drawn to orgs working on systemic policy change, or direct on-the-ground delivery?"*
   - Type: *"Both, but especially direct impact with measurable outcomes"*
   - Bot produces recommendations — 3 charity cards appear on the right with suggested allocation percentages

4. Adjust one weight slightly, show validation:
   - "Must sum to 100 — the UI enforces that."

5. Click "Save & Continue" → redirect to `/deposit`

---

## Step 3: Deposit + Yield (~1 minute)

> "The deposit step is straightforward — but the UX framing is key."

1. Show `/deposit` page
   - Protocol card: "Depositing into Morpho Blue — currently ~5% APY. Your principal is always safe — only yield is donated."
   - Show donation preview: "At $1,000 with 50% yield donation, you'll give ~$25/year. Automatically."

2. Click "Approve" → then "Deposit" (use pre-funded demo wallet)
   - Tx confirms

**Switch to Tab 4 (Dashboard)**

3. Show the yield meter ticking
   - "Yield is already accruing. Here's the current total, the next donation date, and the charity split they set."

---

## Step 4: Automated Donation (~1 minute)

> "Now the magic — let's trigger a donation."

1. Stay on dashboard or go to admin panel
2. Click "Trigger Donation" for the demo wallet address
3. Wait for tx confirmation
4. **Switch to Tab 5 (YieldVault explorer)** → show `DonationExecuted` events
   - Point out multiple events: one per charity, amounts matching the weights

5. Back to dashboard → Donation History table refreshes showing the new entries

> "This is what happens automatically every week via Chainlink Automation — no centralized server, no cron job. The contract handles it."

---

## Step 5: The Reporter (~30 seconds)

**Switch to Tab 7 (Report markdown)**

> "Every Sunday, a third agent scans the crypto-impact landscape and drafts a Substack post."

1. Scroll through the report sections:
   - "This Week in Onchain Impact" — new orgs added, milestone donations
   - "Landscape Scan" — what it found via Unbrowse
   - "What's Missing" — the agent's own editorial take
   - "Requests for Builds" — two specific project ideas

> "A human reviews it and publishes. But the research and drafting is fully automated — this is what content looks like when an AI agent has real web access via Unbrowse, not cached training data."

---

## Closing Statement (30 seconds)

> "YieldGive is three things at once:
>
> For users: the easiest way to make their crypto savings work for causes they care about — without touching the principal.
>
> For charities: a clear on-chain track record is now the price of admission to a sustainable yield stream. That's a real incentive to go transparent.
>
> For the ecosystem: a continuously updating, AI-researched directory of who's actually doing credible work on-chain — published weekly.
>
> Everything here runs for about $10 a month. Thank you."

---

## Backup Slides / Talking Points

**If Morpho is mocked:**
> "For the demo we're using MockYieldVault, which simulates 5% APY without the real Morpho integration — same interface, fully swappable. In production, the real YieldVault uses Morpho Blue on Base."

**If keeper isn't registered:**
> "Chainlink Automation is registered but we're triggering manually for the demo to control timing. In production this runs automatically every 7 days per user."

**If Unbrowse question comes up:**
> "Unbrowse is the required track sponsor — it gives agents direct API access to real browser sessions, 40x fewer tokens than headless scraping. The Researcher agent uses it for every web data call."

**If asked about charity verification:**
> "Three gates: Etherscan verifies on-chain tx recency. Claude scores against a published rubric. And the operator does final human review before any `addCharity()` tx goes out. It's defense in depth."

---

## Demo Wallet Prep

Before the demo, prepare a demo wallet with:
1. MockYieldVault deposit of $1,000 USDC
2. Simulated yield of $15–20 USDC already accrued (fast-forward by calling `setTimestamp` on mock, or set `depositTimestamp` far in the past)
3. Donation config set: 3 charities at 40%/35%/25%
4. `lastTrigger` set to 8 days ago (so keeper condition is met)

This ensures the donation trigger works immediately during the demo without waiting for real yield.
