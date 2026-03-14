# YieldGive — Engineer-Ready Project Spec

**YieldGive** is a yield-powered charitable giving platform built for the Unbrowse hackathon track. Users deposit USDC into Morpho on Base, and their accrued yield is automatically streamed to on-chain charities they select through a conversational AI recommender.

---

## Spec Index

| # | File | Description |
|---|------|-------------|
| 01 | [architecture.md](./01-architecture.md) | System architecture overview and component map |
| 02 | [smart-contracts.md](./02-smart-contracts.md) | Solidity contracts: YieldVault, CharityRegistry, adapters, mocks |
| 03 | [frontend.md](./03-frontend.md) | Next.js pages, components, wagmi hooks |
| 04 | [chatbot.md](./04-chatbot.md) | Charity recommendation chatbot: flow, API, system prompt |
| 05 | [agents.md](./05-agents.md) | Three-agent system: Researcher, Scorer, Reporter |
| 06 | [yield-automation.md](./06-yield-automation.md) | Chainlink Automation / Gelato keeper setup |
| 07 | [cli.md](./07-cli.md) | `npx yieldgive` CLI commands |
| 08 | [database.md](./08-database.md) | Supabase schema, storage, and RLS policies |
| 09 | [infrastructure.md](./09-infrastructure.md) | Hetzner + Coolify deployment for agents |
| 10 | [build-timeline.md](./10-build-timeline.md) | 48-hour hackathon build plan with risk mitigations |
| 11 | [env-vars.md](./11-env-vars.md) | All environment variables with descriptions |
| 12 | [demo-script.md](./12-demo-script.md) | Judge demo walkthrough script |

---

## Project Summary

| Dimension | Detail |
|-----------|--------|
| Blockchain | Base (Sepolia testnet for hackathon, mainnet-ready) |
| Lending | Morpho Blue on Base (via ILendingAdapter) |
| Auth | Privy — embedded wallet + external wallet connect |
| On-ramp | Coinbase Pay via `@coinbase/onchainkit` |
| Frontend | Next.js App Router + Tailwind + wagmi + viem |
| Backend | Supabase (Postgres + Storage) |
| AI model | Claude API (`claude-opus-4-5` agents, `claude-sonnet-4-5` chatbot) |
| Agent browser | Unbrowse (unbrowse.ai) — all web data retrieval |
| Agent framework | Vercel AI SDK v6 `ToolLoopAgent` |
| Automation | Chainlink Automation or Gelato (decentralized keeper) |
| Hosting | Vercel (frontend) + Hetzner CAX11 + Coolify (agents) |
| CLI | `npx yieldgive` — deposit, donate, status, configure |

---

## Build Order

Work in this sequence to unblock parallel development as fast as possible:

1. **Smart contracts** — Deploy `MockYieldVault.sol` first; unblocks all frontend work immediately
2. **Supabase setup** — Create all tables, seed `charities.csv` with 10–15 manually curated orgs
3. **Chatbot API** — Build `/api/chat/route.ts` (streaming) early; most novel UX, needs iteration time
4. **Researcher agent** — Get Unbrowse working with Gitcoin first; prove integration, then expand
5. **Everything else** — Follow the 48-hour timeline in [build-timeline.md](./10-build-timeline.md)

---

## Repository Structure

```
yieldgive/
├── contracts/                        # Foundry project
│   ├── src/
│   │   ├── YieldVault.sol
│   │   ├── CharityRegistry.sol
│   │   ├── interfaces/ILendingAdapter.sol
│   │   ├── adapters/MorphoAdapter.sol
│   │   └── mocks/MockYieldVault.sol
│   ├── test/
│   └── script/                       # Deploy scripts
│
├── app/                              # Next.js (App Router)
│   ├── app/
│   │   ├── page.tsx                  # Landing
│   │   ├── onboard/page.tsx
│   │   ├── onramp/page.tsx
│   │   ├── discover/page.tsx         # Chatbot
│   │   ├── deposit/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── charities/page.tsx
│   │   └── admin/page.tsx
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   └── api/
│       ├── chat/route.ts
│       └── charities/route.ts
│
├── agents/
│   ├── lib/                          # Shared: supabase, unbrowse, types, claude
│   ├── researcher/
│   ├── scorer/
│   └── reporter/
│
├── cli/
│   ├── index.ts
│   └── commands/
│
├── scripts/
│   ├── deploy.ts
│   └── registerKeeper.ts
│
├── reports/                          # Generated Substack drafts
├── spec/                             # ← You are here
└── README.md
```
