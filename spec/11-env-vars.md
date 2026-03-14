# 11 — Environment Variables

## `.env.local` (Next.js App)

Copy this file to `app/.env.local` and fill in all values.

```bash
# ─────────────────────────────────────────────────────────────
# BLOCKCHAIN
# ─────────────────────────────────────────────────────────────

# Base Sepolia public RPC (or use Alchemy/Infura for higher rate limits)
NEXT_PUBLIC_BASE_RPC_URL=https://sepolia.base.org

# Deployed contract addresses — fill after running scripts/deploy.ts
NEXT_PUBLIC_YIELD_VAULT_ADDRESS=0x...
NEXT_PUBLIC_CHARITY_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_MORPHO_ADAPTER_ADDRESS=0x...

# Use MockYieldVault for demo (same address as YIELD_VAULT if deploying mock)
NEXT_PUBLIC_MOCK_YIELD_VAULT_ADDRESS=0x...

# ─────────────────────────────────────────────────────────────
# AUTH — Privy
# ─────────────────────────────────────────────────────────────
# Get from: https://dashboard.privy.io → Your App → Settings

NEXT_PUBLIC_PRIVY_APP_ID=clxxxxxxxxxxxxx
PRIVY_APP_SECRET=...  # Server-side only — never expose to client

# ─────────────────────────────────────────────────────────────
# ON-RAMP — Coinbase Developer Platform
# ─────────────────────────────────────────────────────────────
# Get from: https://portal.cdp.coinbase.com → Your Project → Onramp

NEXT_PUBLIC_COINBASE_APP_ID=...

# ─────────────────────────────────────────────────────────────
# AI — Anthropic
# ─────────────────────────────────────────────────────────────
# Get from: https://console.anthropic.com → API Keys

ANTHROPIC_API_KEY=sk-ant-api03-...  # Server-side only

# ─────────────────────────────────────────────────────────────
# DATABASE — Supabase
# ─────────────────────────────────────────────────────────────
# Get from: https://supabase.com → Your Project → Settings → API

NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...  # Safe to expose to client
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...      # Server-side only — never expose

# ─────────────────────────────────────────────────────────────
# AGENT COORDINATION
# ─────────────────────────────────────────────────────────────
# Coolify webhook URL to trigger Scorer after Researcher completes
# Get from: Coolify → Scorer service → Settings → Webhooks

RESEARCHER_WEBHOOK_URL=https://<your-coolify-ip>:8000/api/v1/webhooks/...
COOLIFY_WEBHOOK_SECRET=...  # Random string, set the same in Coolify webhook settings

# ─────────────────────────────────────────────────────────────
# DEPLOYER
# ─────────────────────────────────────────────────────────────
# Used only in deploy scripts (never in Next.js app)
DEPLOYER_PRIVATE_KEY=0x...

# ─────────────────────────────────────────────────────────────
# OPTIONAL — Post-hackathon
# ─────────────────────────────────────────────────────────────
RESEND_API_KEY=...   # For email notifications (not in scope for hackathon)
```

---

## `agents/.env` (Agent Processes on Hetzner)

Set these in **Coolify's environment variable UI** — do not commit to Git.

```bash
# AI
ANTHROPIC_API_KEY=sk-ant-api03-...

# Supabase (service role for full DB access)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# Agent browser layer
UNBROWSE_API_KEY=...

# On-chain verification
ETHERSCAN_API_KEY=...  # Used for Basescan API (same key works)

# Agent coordination
RESEARCHER_WEBHOOK_URL=https://<your-coolify-ip>:8000/api/v1/webhooks/...
COOLIFY_WEBHOOK_SECRET=...
```

---

## Variable Reference

| Variable | Used In | Where to Get |
|----------|---------|--------------|
| `NEXT_PUBLIC_BASE_RPC_URL` | Frontend, CLI | `https://sepolia.base.org` (free) or Alchemy |
| `NEXT_PUBLIC_YIELD_VAULT_ADDRESS` | Frontend, CLI | After running `scripts/deploy.ts` |
| `NEXT_PUBLIC_CHARITY_REGISTRY_ADDRESS` | Frontend, CLI | After running `scripts/deploy.ts` |
| `NEXT_PUBLIC_MORPHO_ADAPTER_ADDRESS` | Frontend, CLI | After running `scripts/deploy.ts` |
| `DEPLOYER_PRIVATE_KEY` | Deploy scripts only | Your deployer wallet private key |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Frontend | [dashboard.privy.io](https://dashboard.privy.io) |
| `PRIVY_APP_SECRET` | API routes | [dashboard.privy.io](https://dashboard.privy.io) |
| `NEXT_PUBLIC_COINBASE_APP_ID` | Frontend | [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com) |
| `ANTHROPIC_API_KEY` | API routes, Agents | [console.anthropic.com](https://console.anthropic.com) |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend, API routes, Agents | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | API routes, Agents | Supabase → Settings → API |
| `UNBROWSE_API_KEY` | Agents | [unbrowse.ai](https://unbrowse.ai) |
| `ETHERSCAN_API_KEY` | Agents | [basescan.org](https://basescan.org/apis) |
| `RESEARCHER_WEBHOOK_URL` | API routes, Researcher agent | Coolify → Scorer service → Webhooks |
| `COOLIFY_WEBHOOK_SECRET` | API routes, Researcher agent | Set yourself, match in Coolify UI |

---

## Security Notes

- `SUPABASE_SERVICE_ROLE_KEY`: Full database access. Use only in server-side code (API routes, agents). **Never expose to frontend.**
- `PRIVY_APP_SECRET`: Use only in API routes for server-side Privy verification. **Never expose to frontend.**
- `ANTHROPIC_API_KEY`: Use only in API routes and agents. **Never expose to frontend.** The `NEXT_PUBLIC_` prefix must NOT be used.
- `DEPLOYER_PRIVATE_KEY`: Use only in deploy scripts. Add to `.gitignore`. Never commit.

## `.gitignore` additions

```
.env.local
.env
.env.production
*.env

# Foundry
contracts/broadcast/
contracts/cache/
contracts/out/

# Reports (large markdown files)
reports/*.md

# Coolify
coolify/
```
