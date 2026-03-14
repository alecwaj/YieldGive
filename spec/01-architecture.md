# 01 — System Architecture

## High-Level Component Map

```
┌─────────────────────────────────────────────────────────────────────┐
│  USER BROWSER                                                        │
│  Next.js on Vercel                                                  │
│                                                                      │
│  /onboard  → Privy auth (embedded or external wallet)              │
│  /onramp   → Coinbase Pay (USDC funding)                           │
│  /discover → CharityBot (streaming Claude chat)                    │
│  /deposit  → Morpho deposit via YieldVault                         │
│  /dashboard→ YieldMeter, DonationHistory, charity config           │
│  /charities→ Browse full registry (CSV from Supabase Storage)      │
│  /admin    → Operator panel: agent proposals queue                 │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ wagmi + viem + RPC
┌──────────────────────▼──────────────────────────────────────────────┐
│  BASE BLOCKCHAIN (testnet: Base Sepolia, mainnet: Base)             │
│                                                                      │
│  YieldVault.sol          ← main user-facing contract               │
│  CharityRegistry.sol     ← operator-managed charity list           │
│  MorphoAdapter.sol       ← ILendingAdapter impl for Morpho Blue    │
│  MockYieldVault.sol      ← demo fallback (simulated 5% APY)        │
│                                                                      │
│  Chainlink Automation / Gelato keeper                               │
│  └─ calls triggerWeeklyDonation(user) every 7 days                 │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────────┐
│  SHARED STATE — Supabase (free tier)                                │
│                                                                      │
│  Tables:  user_configs, charities, research_queue,                 │
│           proposals, reports                                        │
│  Storage: charities.csv (live charity list for chatbot + frontend) │
│           reports/YYYY-MM-DD.md (weekly Substack drafts)           │
└──────────┬────────────────────────────────────┬─────────────────────┘
           │                                    │
┌──────────▼────────────┐          ┌────────────▼─────────────────────┐
│  NEXT.JS API ROUTES   │          │  AGENTS — Hetzner CAX11 (~$4/mo) │
│  (Vercel serverless)  │          │  managed by Coolify               │
│                       │          │                                    │
│  /api/chat            │          │  agent-researcher/                │
│  └─ streaming chatbot │          │  └─ Unbrowse: Gitcoin, Glodollar  │
│     Claude API        │          │     Etherscan verify              │
│                       │          │     → writes research_queue       │
│  /api/charities       │          │                                    │
│  └─ fetch + parse CSV │          │  agent-scorer/                    │
│     from Supabase     │          │  └─ reads research_queue          │
│     Storage           │          │     Claude rubric scoring         │
│                       │          │     → writes proposals            │
│                       │          │     → updates charities.csv       │
│                       │          │                                    │
│                       │          │  agent-reporter/                  │
│                       │          │  └─ Unbrowse: landscape scan      │
│                       │          │     Claude drafts Substack post   │
│                       │          │     → writes reports table + file │
└───────────────────────┘          └───────────────────────────────────┘
```

---

## Data Flow: User Deposit → Yield → Donation

```
User deposits USDC
       │
       ▼
YieldVault.deposit(amount, morphoAdapter)
  ├─ records principalSnapshot[user] = amount
  ├─ calls MorphoAdapter.deposit(amount)
  └─ Morpho Blue holds USDC, mints aUSDC to YieldVault

       │ time passes, yield accrues
       ▼

Chainlink/Gelato keeper: triggerWeeklyDonation(user)
  ├─ getYieldAccrued(user) = aUSDC balance − principalSnapshot
  ├─ yieldToDonate = yieldAccrued × user.yieldPct / 100
  ├─ MorphoAdapter.withdraw(yieldToDonate) → USDC
  ├─ for each charity in user.charities:
  │    transfer(charity.wallet, yieldToDonate × charity.weight / 100)
  │    emit DonationExecuted(user, charity, amount, timestamp)
  └─ lastTrigger[user] = block.timestamp
```

---

## Data Flow: Agent Pipeline

```
Researcher Agent (on-demand + weekly)
  ├─ Unbrowse fetches Gitcoin, Glodollar, Giveth, etc.
  ├─ validates each org via Etherscan API (tx recency)
  └─ writes raw data to research_queue table

       │ triggers Scorer via Coolify webhook
       ▼

Scorer Agent
  ├─ reads research_queue (unscored items)
  ├─ Claude API evaluates each against rubric (0–100)
  ├─ score ≥ 60 → writes to proposals (recommendation: "Add")
  ├─ 40–59     → writes to proposals (recommendation: "Hold")
  ├─ < 40      → writes to proposals (recommendation: "Reject")
  └─ accepted orgs synced → charities.csv in Supabase Storage

       │ admin reviews proposals queue
       ▼

Admin Panel (/admin)
  ├─ operator sees proposals with score + rationale
  ├─ Accept → calls CharityRegistry.addCharity() on-chain
  └─ Reject → marks proposal rejected in Supabase

Reporter Agent (every Sunday via Coolify cron)
  ├─ Unbrowse scans Twitter, Gitcoin, newsletters
  ├─ reads charities table (this week's adds/removes)
  ├─ Claude drafts Substack post
  └─ saves to reports/ table + Supabase Storage
```

---

## Key Technical Boundaries

| Boundary | Technology | Notes |
|----------|-----------|-------|
| Wallet auth | Privy | Embedded wallet default; MetaMask/Coinbase Wallet external option |
| On-chain reads | viem + wagmi | Read contract state, listen for events |
| On-chain writes | viem + Privy wallet | Sign + broadcast via user's embedded or external wallet |
| Fiat on-ramp | Coinbase Pay (`@coinbase/onchainkit`) | Sandbox for hackathon |
| Yield protocol | Morpho Blue on Base | Single adapter; swappable via ILendingAdapter |
| Automation | Chainlink Automation or Gelato | Decentralized; not a centralized cron |
| AI chatbot | Claude API `claude-sonnet-4-5` | Streaming via Next.js API route |
| Agent AI | Claude API `claude-opus-4-5` | Higher reasoning for scoring + drafting |
| Web scraping | Unbrowse (unbrowse.ai) | All agent web data retrieval; no headless browser |
| Database | Supabase Postgres | Free tier sufficient for hackathon volume |
| File storage | Supabase Storage | `charities.csv` + report markdown files |
| Agent hosting | Hetzner CAX11 + Coolify | ~$4/mo; auto-deploy from GitHub |

---

## Protocol Extensibility

`YieldVault.sol` accepts any address implementing `ILendingAdapter`:

```
ILendingAdapter
├─ MorphoAdapter   ← implemented (hackathon)
├─ AaveAdapter     ← future
├─ CompoundAdapter ← future
└─ MockAdapter     ← demo fallback
```

The frontend `<ProtocolPicker />` component will surface available adapters and their current APYs. For the hackathon, only Morpho is live; `MockYieldVault` is the fallback if Morpho integration is blocked.
