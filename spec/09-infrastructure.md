# 09 — Infrastructure: Hetzner + Coolify

## Overview

Three agent processes run as always-on Node.js services on a single **Hetzner CAX11** ARM server managed by **Coolify** (open-source self-hosted PaaS). The frontend and API routes run on Vercel free tier. All state lives in Supabase — agents are fully stateless.

---

## Cost Breakdown

| Service | Platform | Monthly Cost |
|---------|----------|-------------|
| Next.js frontend + API routes | Vercel (Hobby) | $0 |
| Database + Storage | Supabase (Free tier) | $0 |
| Agent processes + cron | Hetzner CAX11 + Coolify | ~$4 |
| Decentralized keeper | Chainlink / Gelato | ~$2–5 |
| **Total** | | **~$6–10/mo** |

---

## Hetzner CAX11 Specs

| Spec | Value |
|------|-------|
| CPU | 2 vCPU (ARM Ampere Altra) |
| RAM | 4 GB |
| Storage | 40 GB NVMe SSD |
| Network | 20 TB included traffic |
| OS | Ubuntu 24.04 (ARM) |
| Price | €3.79/mo (~$4) |

The CAX11 ARM architecture is compatible with Node.js 20+ and tsx. All three agents comfortably fit in 4GB RAM.

---

## Setup Steps

### 1. Create Hetzner Server (~2 minutes)

1. Sign up at `https://hetzner.com/cloud`
2. Create project → "Add Server"
3. Location: Falkenstein (EU) or Hillsboro (US)
4. Image: **Ubuntu 24.04 (ARM64)**
5. Type: **CAX11**
6. Add your SSH public key
7. Click "Create & Buy Now"
8. Note the server's public IP

### 2. Install Coolify (~5 minutes)

SSH into the server:
```bash
ssh root@<your-server-ip>
```

Run the Coolify one-line installer:
```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Wait for installation (~3 minutes). Then access Coolify at:
```
http://<your-server-ip>:8000
```

Complete the initial setup wizard (create admin account).

### 3. Connect GitHub Repository

1. In Coolify: Settings → Source → Add GitHub App
2. Authorize Coolify to access your `yieldgive` repository
3. This enables auto-deploy on push to `main`

### 4. Create Three Agent Services

For each agent (Researcher, Scorer, Reporter):

1. Coolify → New Resource → Application → Select GitHub repo
2. **Build pack:** Nixpacks (auto-detects Node.js)
3. **Build command:** `cd agents && npm install && npm run build`
4. **Start command:**
   - Researcher: `node agents/dist/researcher/index.js`
   - Scorer: `node agents/dist/scorer/index.js`
   - Reporter: `node agents/dist/reporter/index.js`
5. **Port:** None needed (no HTTP server, these are workers)

### 5. Configure Environment Variables

In Coolify, for each agent service, add:

```
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
UNBROWSE_API_KEY=...
ETHERSCAN_API_KEY=...
COOLIFY_WEBHOOK_SECRET=your-random-secret
RESEARCHER_WEBHOOK_URL=https://coolify.<your-domain>/api/v1/webhooks/...
```

**Important:** Never commit secrets to Git. Use Coolify's env var UI exclusively.

### 6. Set Cron Schedules

In Coolify, for each agent service, set the scheduled restart/trigger:

| Agent | Schedule | Cron Expression |
|-------|----------|----------------|
| Researcher | On-demand (webhook) + weekly | `0 6 * * 1` (Mon 06:00 UTC) |
| Scorer | After Researcher (webhook-triggered) | On-demand only |
| Reporter | Every Sunday | `0 8 * * 0` (Sun 08:00 UTC) |

For the Scorer: configure a Coolify webhook that triggers the process when called. The Researcher calls this webhook at the end of its run.

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub (yieldgive repo)                                     │
│  Push to main → Coolify webhook → auto-deploy agents        │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  Hetzner CAX11 (Ubuntu 24.04 ARM)                           │
│  Public IP: x.x.x.x                                         │
│                                                              │
│  Coolify (port 8000)                                         │
│  ├─ agent-researcher  → process (runs on cron or webhook)   │
│  ├─ agent-scorer      → process (runs on webhook trigger)   │
│  └─ agent-reporter    → process (runs on cron Sunday)       │
│                                                              │
│  No persistent storage needed on server                      │
│  All state → Supabase                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Coolify Webhook Setup (Agent Coordination)

The Researcher triggers the Scorer via a Coolify webhook after completing its run:

1. In Coolify → Scorer service → Settings → Webhooks
2. Copy the webhook URL (format: `https://your-coolify-ip:8000/api/v1/webhooks/xxxxxxxx`)
3. Set `RESEARCHER_WEBHOOK_URL` in Researcher's env vars
4. Set `COOLIFY_WEBHOOK_SECRET` in both Researcher and Coolify webhook settings

Researcher code (at end of run):
```typescript
if (process.env.RESEARCHER_WEBHOOK_URL) {
  await fetch(process.env.RESEARCHER_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.COOLIFY_WEBHOOK_SECRET}`,
    },
  });
}
```

---

## Admin Webhook: Trigger Researcher from Frontend

The `/admin` page's "Run Researcher" button calls a Next.js API route that triggers the Coolify webhook:

**File:** `app/app/api/admin/run-researcher/route.ts`

```typescript
export async function POST(req: Request) {
  // Verify operator wallet (check auth header or Privy session)

  const response = await fetch(process.env.RESEARCHER_WEBHOOK_URL!, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.COOLIFY_WEBHOOK_SECRET}`,
    },
  });

  if (!response.ok) {
    return Response.json({ error: 'Failed to trigger researcher' }, { status: 500 });
  }

  return Response.json({ success: true, message: 'Researcher agent triggered' });
}
```

---

## Logs & Monitoring

- View agent logs in Coolify's built-in log viewer (real-time streaming)
- Each agent `console.log()`s step progress — visible in Coolify logs
- Supabase's built-in table editor shows `research_queue`, `proposals` state in real-time
- No external logging service needed for hackathon

---

## Scaling Path (Post-Hackathon)

| Scale point | Action | Cost |
|-------------|--------|------|
| > 50 agent runs/day | Upgrade to Hetzner CPX31 (4 vCPU, 8GB) | ~€10.49/mo |
| > 10,000 DB rows | Upgrade Supabase to Pro | $25/mo |
| Agent parallelism | Add second CAX11, split agents | +$4/mo |
| > 1M Vercel requests | Upgrade Vercel to Pro | $20/mo |

---

## One-Time Pre-Hackathon Checklist

- [ ] Create Hetzner account, spin up CAX11
- [ ] Run Coolify installer, complete setup wizard
- [ ] Connect GitHub repo to Coolify
- [ ] Create 3 agent services with correct build/start commands
- [ ] Set all env vars in Coolify UI
- [ ] Set cron schedules (Researcher weekly, Reporter Sunday)
- [ ] Configure Scorer webhook URL
- [ ] Test: manually trigger Researcher, verify `research_queue` populates
- [ ] Test: manually trigger Scorer, verify `proposals` populates
- [ ] Test: manually trigger Reporter, verify `reports/YYYY-MM-DD.md` created
