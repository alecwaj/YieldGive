# 10 — 48-Hour Build Timeline

## Overview

The hackathon runs 48 hours. Build in the order below to unblock parallel work as early as possible. The critical path is: contracts → supabase → chatbot → agents.

---

## Phase 0 — Setup (Hours 0–2)

**Goal:** Every system initialized, env vars in place, everyone unblocked.

| Task | Notes |
|------|-------|
| Init git repo, push to GitHub | Branch strategy: `main` = stable, feature branches |
| Create Supabase project | Copy URL + keys to `.env.local` |
| Create Privy app | Copy `NEXT_PUBLIC_PRIVY_APP_ID` |
| Create Coinbase Developer Platform account | Copy `NEXT_PUBLIC_COINBASE_APP_ID` |
| Create Anthropic API key | Copy `ANTHROPIC_API_KEY` |
| Create Unbrowse account | Copy `UNBROWSE_API_KEY` |
| Create Etherscan account | Copy `ETHERSCAN_API_KEY` (for Basescan) |
| Scaffold Foundry project in `/contracts` | `forge init contracts` |
| Scaffold Next.js in `/app` | `npx create-next-app@latest app --typescript --tailwind --app` |
| Install agent dependencies in `/agents` | `npm init`, install `ai`, `@ai-sdk/anthropic`, `@supabase/supabase-js`, `zod` |
| Set up Hetzner + Coolify | Run Coolify installer, connect GitHub repo |

**Risk level:** Low
**Checkpoint:** `.env.local` has all keys. `forge build` succeeds. `npm run dev` starts.

---

## Phase 1 — Smart Contracts (Hours 2–12)

**Goal:** MockYieldVault deployed to Base Sepolia. Real YieldVault + Morpho in progress.

| Order | Task | Priority |
|-------|------|----------|
| 1 | Write `MockYieldVault.sol` | CRITICAL — unblocks all frontend |
| 2 | Write `CharityRegistry.sol` | High |
| 3 | Write `ILendingAdapter.sol` | High |
| 4 | Write `MorphoAdapter.sol` | High (can use mock if blocked) |
| 5 | Write `YieldVault.sol` | High |
| 6 | Write tests for all contracts | Medium |
| 7 | Write deploy script | High |
| 8 | Deploy to Base Sepolia | High |
| 9 | Copy contract addresses to `.env.local` and `app/lib/contracts.ts` | High |

**Risk:** Morpho integration may be complex. Deploy `MockYieldVault` first — it has an identical external interface. Frontend team can use `MockYieldVault` while `YieldVault` is being debugged.

**Checkpoint:** `forge test` passes. `MockYieldVault` deployed. Address in env vars.

---

## Phase 2 — Auth + On-Ramp (Hours 6–16)

**Goal:** Users can sign up and get USDC into their wallet.

*(Can run in parallel with Phase 1 after contracts are deployed)*

| Order | Task |
|-------|------|
| 1 | Install Privy SDK, configure `providers.tsx` |
| 2 | Build `/onboard` page with `<WalletConnector />` |
| 3 | Test embedded wallet creation (email login) |
| 4 | Test external wallet connect (MetaMask) |
| 5 | Build `/onramp` page with `<OnrampWidget />` |
| 6 | Test Coinbase Pay sandbox |
| 7 | Add auth guards to protected routes |

**Risk:** Coinbase Pay sandbox may require domain verification. Fallback: instruct user to manually transfer test USDC from faucet.

**Checkpoint:** Can log in via Privy, see wallet address in nav, open Coinbase Pay widget.

---

## Phase 3 — Chatbot (Hours 12–22)

**Goal:** `/discover` page works end-to-end. User gets charity recommendations and config is saved.

| Order | Task |
|-------|------|
| 1 | Set up Supabase tables (run schema SQL) |
| 2 | Seed `charities.csv` in Supabase Storage with 10–15 orgs |
| 3 | Build `/api/chat` streaming endpoint |
| 4 | Test chatbot via curl/Postman |
| 5 | Build `<CharityBot />` component with `useChat()` |
| 6 | Build `<CharityCard />` component |
| 7 | Build `/discover` page layout (chat left, cards right) |
| 8 | Wire "Save & Continue" → Supabase upsert → redirect to `/deposit` |
| 9 | Test full flow: chat → recommendations → save → proceed |

**Risk:** Claude API streaming may need debugging with Next.js App Router. Use `result.toDataStreamResponse()` from Vercel AI SDK — this handles all the edge cases.

**Checkpoint:** Full chat conversation completes, JSON recommendations parse, cards render, config saves to Supabase.

---

## Phase 4 — Deposit + Dashboard (Hours 18–30)

**Goal:** Users can deposit USDC, see yield, view donation history.

| Order | Task |
|-------|------|
| 1 | Build `useYieldVault()` hook |
| 2 | Build `useCharityRegistry()` hook |
| 3 | Build `/deposit` page |
| 4 | Test deposit flow: approve USDC → deposit → confirm |
| 5 | Build `<YieldMeter />` component |
| 6 | Build `<DonationHistory />` (reads on-chain events) |
| 7 | Build `/dashboard` page |
| 8 | Build withdraw modal |
| 9 | Build `/charities` browse page |

**Checkpoint:** Can deposit USDC, see yield accruing in `<YieldMeter />`, see donation history table.

---

## Phase 5 — Researcher Agent (Hours 20–30)

**Goal:** Unbrowse integration proven, Gitcoin scraper works, items appear in `research_queue`.

| Order | Task |
|-------|------|
| 1 | Build `agents/lib/unbrowse.ts` (Unbrowse tool wrapper) |
| 2 | Build `agents/lib/supabase.ts` (shared client + typed queries) |
| 3 | Build `agents/lib/types.ts` |
| 4 | Test Unbrowse with a single Gitcoin page |
| 5 | Build `agents/researcher/validator.ts` (Etherscan tool) |
| 6 | Build `agents/researcher/agent.ts` (full `generateText` loop) |
| 7 | Run researcher, verify `research_queue` table populates |
| 8 | Add Glodollar, Giveth sources |
| 9 | Deploy to Coolify |

**Risk:** Unbrowse API setup may require account verification. Fallback: create a pre-seeded `research_queue.json` from manual research and seed the Supabase table directly.

**Checkpoint:** Run `node agents/researcher/index.ts` locally, see 5+ items appear in Supabase `research_queue`.

---

## Phase 6 — Scorer Agent (Hours 28–36)

**Goal:** Proposals appear in Supabase, admin panel shows them, operator can accept.

| Order | Task |
|-------|------|
| 1 | Build `agents/scorer/agent.ts` with `generateObject` rubric scoring |
| 2 | Build `agents/scorer/csvSync.ts` |
| 3 | Run scorer, verify `proposals` table populates |
| 4 | Verify `charities.csv` updates in Supabase Storage |
| 5 | Build `/admin` page |
| 6 | Build `<AdminQueue />` component |
| 7 | Wire Accept button → `CharityRegistry.addCharity()` + Supabase update |
| 8 | Test full pipeline: Researcher → Scorer → Admin accept → on-chain |
| 9 | Deploy Scorer to Coolify |

**Checkpoint:** Accept a proposal from admin panel, see `NewCharityAdded` event on Basescan.

---

## Phase 7 — Reporter Agent (Hours 32–40)

**Goal:** Weekly Substack draft generated, saved locally and in Supabase.

| Order | Task |
|-------|------|
| 1 | Build `agents/reporter/agent.ts` |
| 2 | Run reporter, verify markdown draft generated |
| 3 | Verify saved to `reports/YYYY-MM-DD.md` locally and Supabase Storage |
| 4 | Verify saved to `reports` table in Supabase |
| 5 | Deploy to Coolify with Sunday cron schedule |

**Checkpoint:** `reports/YYYY-MM-DD.md` exists and contains all 5 required sections.

---

## Phase 8 — Keeper + CLI (Hours 34–42)

**Goal:** Automated donations work. CLI functional.

| Order | Task |
|-------|------|
| 1 | Build `cli/index.ts` and all command files |
| 2 | Test `yieldgive init`, `yieldgive status`, `yieldgive deposit` |
| 3 | Test `yieldgive donate` (manual trigger) |
| 4 | Register Chainlink Automation or Gelato upkeep |
| 5 | Verify keeper triggers `triggerWeeklyDonation` on schedule |
| 6 | Build `<BatchKeeper.sol>` if using Chainlink batch pattern |
| 7 | Test `yieldgive agent proposals` |

**Risk:** Keeper registration may require LINK token funding or Gelato account setup. Fallback: use admin panel's "Trigger Donation" button for demo.

**Checkpoint:** `yieldgive status` shows balance and yield. Keeper (or manual trigger) distributes USDC to charities on-chain.

---

## Phase 9 — Integration (Hours 40–46)

**Goal:** Full E2E flow works without errors.

Run the complete demo script from start to finish:
1. Sign up via Privy (new account)
2. Fund with USDC (Coinbase Pay or manual transfer)
3. Chat with bot at `/discover` → get recommendations → save
4. Deposit USDC at `/deposit`
5. View yield at `/dashboard`
6. Trigger donation (keeper or manual)
7. View donation history
8. Open admin panel → run Researcher → score → accept proposal → verify on-chain

Fix any bugs found during integration.

---

## Phase 10 — Polish + Demo Prep (Hours 46–48)

| Task |
|------|
| Write `README.md` with setup instructions |
| Add Base Sepolia explorer links for all contracts |
| Prepare demo wallet with existing USDC and yield accrued (don't wait for real yield to accrue during demo!) |
| Practice demo script 3× |
| Write hackathon submission writeup |
| Push final code |

---

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Morpho integration blocked | Use `MockYieldVault.sol` — identical interface, simulated 5% APY |
| Unbrowse setup slow | Seed `research_queue` manually with pre-researched orgs |
| Chainlink/Gelato registration fails | Use admin panel "Trigger Donation" button for demo |
| Coinbase Pay sandbox issues | Manual USDC transfer from any Base Sepolia faucet |
| Claude API rate limit | Cache chatbot recommendations in Supabase after first generation |
| Morpho APY data unavailable | Hardcode "~5% APY" in UI for demo |
| Supabase free tier limit | Pre-warm with seed data; limit research_queue to 50 items |

---

## Build Order Priority Summary

If time runs short, cut in this order (keep must-haves):

| Priority | Deliverable |
|----------|------------|
| MUST | MockYieldVault deployed + working |
| MUST | Chatbot recommendations → charity config saved |
| MUST | Deposit flow working |
| MUST | Researcher agent with at least one source (Gitcoin) |
| MUST | Scorer agent + admin panel with Accept button |
| SHOULD | Real YieldVault + MorphoAdapter |
| SHOULD | Reporter agent generating Substack draft |
| SHOULD | Keeper registration |
| NICE | CLI |
| NICE | Multiple Researcher sources |
| NICE | Keeper automation (can demo manual trigger) |
