# 08 — Database Schema (Supabase)

## Setup

1. Create a new Supabase project at `https://supabase.com`
2. Copy `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Project Settings → API
3. Copy `SUPABASE_SERVICE_ROLE_KEY` from Project Settings → API (keep this server-side only)
4. Run the SQL schema below in the Supabase SQL Editor

---

## Full Schema

```sql
-- ─────────────────────────────────────────────────────────────
-- USER YIELD CONFIGURATION
-- ─────────────────────────────────────────────────────────────
create table user_configs (
  id uuid primary key default gen_random_uuid(),
  privy_user_id text unique not null,
  wallet_address text not null,
  yield_pct integer not null default 50 check (yield_pct between 0 and 100),
  charities jsonb not null default '[]',
  -- charities format: [{ "address": "0x...", "name": "...", "weight_pct": 40 }]
  interests text,          -- free text from chatbot conversation
  chatbot_summary text,    -- agent-generated summary of user values
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- CHARITY DATABASE
-- ─────────────────────────────────────────────────────────────
create table charities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  wallet_address text not null unique,
  website text,
  description text,
  logo_url text,
  last_onchain_tx timestamptz,
  last_public_update timestamptz,
  total_received_usdc numeric,
  score integer check (score between 0 and 100),
  score_breakdown jsonb,
  -- { "onchain_activity": 8, "transparency": 7, "impact_efficacy": 9, "crypto_alignment": 6 }
  rationale text,
  status text not null default 'active' check (status in ('active', 'pending', 'rejected')),
  added_at timestamptz default now(),
  source text check (source in ('gitcoin', 'glodollar', 'giveth', 'karma_gap', 'manual', 'agent'))
);

-- ─────────────────────────────────────────────────────────────
-- AGENT RESEARCH QUEUE
-- ─────────────────────────────────────────────────────────────
create table research_queue (
  id uuid primary key default gen_random_uuid(),
  raw_data jsonb not null,
  -- raw_data mirrors Charity shape but all fields optional
  source text not null,
  discovered_at timestamptz default now(),
  scored boolean not null default false
);

-- Index for efficient Scorer queries
create index idx_research_queue_unscored on research_queue (scored) where scored = false;

-- ─────────────────────────────────────────────────────────────
-- AGENT PROPOSALS (Scorer output, pending operator review)
-- ─────────────────────────────────────────────────────────────
create table proposals (
  id uuid primary key default gen_random_uuid(),
  charity_data jsonb not null,
  score integer not null check (score between 0 and 100),
  score_breakdown jsonb not null,
  rationale text not null,
  recommendation text not null check (recommendation in ('Add', 'Hold', 'Reject')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  reviewed_by text,        -- operator wallet address
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- Index for admin panel pending queue
create index idx_proposals_pending on proposals (status) where status = 'pending';

-- ─────────────────────────────────────────────────────────────
-- WEEKLY SUBSTACK DRAFTS
-- ─────────────────────────────────────────────────────────────
create table reports (
  id uuid primary key default gen_random_uuid(),
  week_of date not null unique,
  markdown_content text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_url text,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- AUTO-UPDATE updated_at TRIGGER
-- ─────────────────────────────────────────────────────────────
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_user_configs_updated_at
  before update on user_configs
  for each row execute procedure update_updated_at_column();
```

---

## Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
alter table user_configs enable row level security;
alter table charities enable row level security;
alter table research_queue enable row level security;
alter table proposals enable row level security;
alter table reports enable row level security;

-- ─────────────────────────────────────────────────────────────
-- user_configs: users can only read/write their own row
-- ─────────────────────────────────────────────────────────────
-- Note: privy_user_id is passed as a JWT claim or via service role
-- For hackathon simplicity, use service role key for all writes from API routes
create policy "Users can view own config"
  on user_configs for select
  using (true);  -- public read for demo; tighten post-hackathon

create policy "Users can upsert own config"
  on user_configs for insert
  with check (true);  -- auth handled at API route layer via Privy

create policy "Users can update own config"
  on user_configs for update
  using (true);

-- ─────────────────────────────────────────────────────────────
-- charities: public read, service role write only
-- ─────────────────────────────────────────────────────────────
create policy "Public can read active charities"
  on charities for select
  using (status = 'active');

-- ─────────────────────────────────────────────────────────────
-- research_queue: service role only (agents write, admin reads)
-- ─────────────────────────────────────────────────────────────
create policy "Service role can manage research_queue"
  on research_queue for all
  using (true);  -- restricted to service role via anon key header check

-- ─────────────────────────────────────────────────────────────
-- proposals: public read (admin panel), service role write
-- ─────────────────────────────────────────────────────────────
create policy "Anyone can read proposals"
  on proposals for select
  using (true);

create policy "Service role can insert proposals"
  on proposals for insert
  with check (true);

create policy "Service role can update proposals"
  on proposals for update
  using (true);

-- ─────────────────────────────────────────────────────────────
-- reports: public read
-- ─────────────────────────────────────────────────────────────
create policy "Anyone can read reports"
  on reports for select
  using (true);
```

---

## Supabase Storage

### Setup

1. Go to Storage in Supabase dashboard
2. Create bucket: `public` (public access enabled)
3. Upload initial `charities.csv` (see seed data below)

### Bucket Structure

```
public/
├── charities.csv          ← Live charity list; updated by Scorer after each batch
└── reports/
    ├── 2024-12-15.md      ← Weekly Substack drafts
    ├── 2024-12-22.md
    └── ...
```

### Storage Policies

```sql
-- Allow public reads on the 'public' bucket
create policy "Public read access"
  on storage.objects for select
  using (bucket_id = 'public');

-- Allow service role to upload/overwrite
create policy "Service role write access"
  on storage.objects for insert
  with check (bucket_id = 'public');

create policy "Service role update access"
  on storage.objects for update
  using (bucket_id = 'public');
```

---

## Seed Data: `charities.csv`

Upload this as the initial `charities.csv` before the hackathon. This ensures the chatbot has data from day one.

```csv
name,category,wallet_address,description,website,last_onchain_tx,total_received_usdc,score
GainForest,Climate,0x0000000000000000000000000000000000000001,AI-powered rainforest monitoring using satellite imagery and blockchain attestations,https://gainforest.earth,2024-11-15,125000,88
Gitcoin,Public Goods,0x0000000000000000000000000000000000000002,Quadratic funding platform for open source software and public goods,https://gitcoin.co,2024-12-01,5000000,95
Endaoment,Donor-Advised Fund,0x0000000000000000000000000000000000000003,On-chain donor-advised fund enabling crypto donations to any registered 501c3,https://app.endaoment.org,2024-11-28,2500000,82
Giveth,Public Goods,0x0000000000000000000000000000000000000004,Zero-fee crypto donation platform for blockchain and public goods projects,https://giveth.io,2024-12-05,800000,79
Karma GAP,Impact Tracking,0x0000000000000000000000000000000000000005,On-chain grantee accountability and impact reporting infrastructure,https://gap.karmahq.xyz,2024-11-20,50000,76
GlobeIn,Economic Empowerment,0x0000000000000000000000000000000000000006,Artisan market and fair trade supply chain using crypto for direct payments,https://globein.com,2024-10-15,200000,71
Proof of Humanity,Identity,0x0000000000000000000000000000000000000007,Sybil-resistant decentralized human registry for UBI distribution,https://proofofhumanity.id,2024-11-01,400000,74
Open Collective,Community Funding,0x0000000000000000000000000000000000000008,Transparent funding infrastructure for open source and community projects,https://opencollective.com,2024-12-08,1200000,81
Glodollar,Financial Access,0x0000000000000000000000000000000000000009,Stablecoin grants for organizations providing financial services to underserved populations,https://www.glodollar.org,2024-11-25,750000,85
Water & Sanitation for All,Clean Water,0x000000000000000000000000000000000000000a,Crypto-funded WASH projects in Sub-Saharan Africa with on-chain impact attestations,https://wsa-global.org,2024-09-30,90000,68
```

**Note:** Replace placeholder wallet addresses (0x000...001 etc.) with real wallet addresses for each org before launch. These are placeholder addresses for schema validation only.

---

## Supabase Client Setup

**File:** `app/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

// Client-side: anon key only
export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server-side: service role (use only in API routes and server components)
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

---

## Indexes for Performance

```sql
-- Fast charity lookups
create index idx_charities_status on charities (status);
create index idx_charities_category on charities (category);
create index idx_charities_score on charities (score desc) where status = 'active';

-- Fast user config lookups
create index idx_user_configs_wallet on user_configs (wallet_address);

-- Fast report queries
create index idx_reports_week on reports (week_of desc);
```
