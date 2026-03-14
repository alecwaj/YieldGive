# YieldGive

Yield-powered charitable giving on Base. Deposit USDC into Morpho, earn yield, automatically donate to verified on-chain charities.

Built for the **Unbrowse hackathon track** — AI agents use [Unbrowse](https://unbrowse.ai) to continuously research, score, and surface the best impact organizations.

## Quick Start

### 1. Clone and set up env

```bash
git clone https://github.com/your-org/yieldgive
cp .env.example app/.env.local
# Fill in all values in app/.env.local
```

### 2. Deploy contracts

```bash
cd contracts
# Install Foundry: https://getfoundry.sh
forge install
forge build
forge script script/Deploy.s.sol --rpc-url $NEXT_PUBLIC_BASE_RPC_URL --broadcast
# Copy deployed addresses to .env.local
```

### 3. Set up Supabase

1. Create project at [supabase.com](https://supabase.com)
2. Run SQL from `spec/08-database.md` in the SQL Editor
3. Upload `charities.csv` from seed data in the spec to Supabase Storage → `public/charities.csv`

### 4. Run the app

```bash
cd app
npm install
npm run dev
# Open http://localhost:3000
```

### 5. Run an agent (optional)

```bash
cd agents
npm install
# Set env vars (ANTHROPIC_API_KEY, SUPABASE_*, UNBROWSE_API_KEY, ETHERSCAN_API_KEY)
npm run researcher   # Discover new orgs
npm run scorer       # Score and rank discovered orgs
npm run reporter     # Generate weekly Substack draft
```

### 6. CLI

```bash
cd cli
npm install
npx tsx index.ts init --private-key 0x...
npx tsx index.ts status
npx tsx index.ts deposit --amount 100
npx tsx index.ts configure --yield-pct 50 --charities 0x111,0x222 --weights 60,40
npx tsx index.ts donate
```

## Architecture

```
User → Privy auth → Coinbase Pay (USDC) → /discover (ChatBot)
     → /deposit (Morpho via YieldVault) → yield accrues
     → Chainlink/Gelato keeper → weekly USDC → charities

Agents (Hetzner + Coolify):
  Researcher → research_queue (Supabase)
  Scorer     → proposals + charities.csv
  Reporter   → reports/ (weekly Substack draft)

Admin → review proposals → addCharity() on-chain
```

## Project Spec

Full engineer-ready spec in [/spec](./spec/README.md).

## Tech Stack

| Layer | Tech |
|-------|------|
| Blockchain | Base Sepolia |
| Lending | Morpho Blue |
| Auth | Privy |
| On-ramp | Coinbase Pay |
| Frontend | Next.js 15 + Tailwind + wagmi v2 |
| AI | Claude API (Anthropic) |
| Agent browser | Unbrowse |
| Agent framework | Vercel AI SDK v6 |
| DB | Supabase |
| Agent hosting | Hetzner CAX11 + Coolify |
| CLI | Node.js + viem + Commander |

## License

MIT
