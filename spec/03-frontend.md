# 03 — Frontend

## Stack

- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS
- **Wallet:** wagmi v2 + viem + Privy
- **On-ramp:** `@coinbase/onchainkit`
- **State:** React Query (via wagmi) + minimal local state

---

## Pages

### `/` — Landing Page

**File:** `app/app/page.tsx`

**Purpose:** Convert visitors. Explain the product in 30 seconds.

**Content:**
1. Hero: "Your savings earn yield. Your yield funds the world." — CTA: "Get Started"
2. How it works (3 steps): Deposit → Earn → Give
3. Live stats bar: total yield donated (on-chain read from `DonationExecuted` events), active charities count
4. Charity preview grid (3 cards from `charities.csv`)
5. Footer: GitHub, Unbrowse, Base, Morpho credits

**No auth required.** CTA links to `/onboard`.

---

### `/onboard` — Auth

**File:** `app/app/onboard/page.tsx`

**Purpose:** Sign user in and set up their wallet.

**Flow:**
1. Show two options:
   - "Create wallet" → Privy embedded wallet (email / Google / Apple)
   - "Connect wallet" → MetaMask, Coinbase Wallet, WalletConnect
2. On success: redirect to `/onramp`

**Components:**
- `<WalletConnector />`

**Privy config:**
```typescript
// app/lib/privy.ts
import { PrivyProvider } from '@privy-io/react-auth';

export const privyConfig = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  config: {
    loginMethods: ['email', 'google', 'apple', 'wallet'],
    appearance: { theme: 'light' },
    embeddedWallets: {
      createOnLogin: 'users-without-wallets',
    },
  },
};
```

**Auth guard:** Pages `/deposit`, `/dashboard`, `/admin` require auth. Use Privy's `usePrivy().authenticated` to redirect to `/onboard` if not authenticated.

---

### `/onramp` — Fund Wallet

**File:** `app/app/onramp/page.tsx`

**Purpose:** Help user get USDC into their wallet.

**Content:**
1. Show current USDC balance (read from chain)
2. If balance > 0: show "Ready to deposit" — link to `/discover`
3. If balance == 0: show `<OnrampWidget />`
4. Manual alternative: "Already have USDC? Skip this step"

**Skip condition:** If user already has USDC, offer button to proceed directly to `/discover`.

---

### `/discover` — Chatbot Charity Recommender

**File:** `app/app/discover/page.tsx`

**Purpose:** Conversational UI to understand user values and recommend charities.

**Layout:**
- Full-width chat interface (not a sidebar widget)
- Message thread on the left (70% width)
- Charity recommendation cards appear on the right (30% width) after bot outputs recommendations

**Flow:**
1. Bot sends greeting message on page load
2. User responds to 3–5 questions
3. Bot streams recommendations
4. Frontend parses the JSON block from the stream
5. Charity cards render on right panel with pre-filled allocation percentages
6. User can adjust % weights (inputs must sum to 100 — validate client-side)
7. "Save & Continue" → POST to Supabase `user_configs`, redirect to `/deposit`

**See [chatbot.md](./04-chatbot.md) for full chatbot spec.**

---

### `/deposit` — Deposit USDC

**File:** `app/app/deposit/page.tsx`

**Purpose:** Deposit USDC into YieldVault via Morpho.

**Content:**
1. Protocol info card:
   - "Depositing into Morpho Blue" with current APY (fetched from Morpho or hardcoded for demo)
   - "Your principal is always safe — only yield is donated"
2. Amount input (USDC, with MAX button reading wallet balance)
3. Donation preview:
   - "At 5% APY on $1,000, you'll donate ~$25/year"
   - "Your charity split: [Org A 50%, Org B 30%, Org C 20%]" (from saved config)
4. "Approve USDC" button → calls `usdc.approve(yieldVaultAddress, amount)`
5. "Deposit" button → calls `YieldVault.deposit(amount, morphoAdapterAddress)`
6. On success: redirect to `/dashboard`

**Edge cases:**
- No donation config saved yet: show banner "You haven't set up your charity split yet" with link to `/discover`
- Insufficient USDC balance: disable deposit button, show "Get USDC" link to `/onramp`

---

### `/dashboard` — Main Dashboard

**File:** `app/app/dashboard/page.tsx`

**Purpose:** Ongoing view of yield, donations, and config.

**Sections:**

1. **Yield Summary** (`<YieldMeter />`)
   - Total deposited principal
   - Yield accrued to date (live, polling every 30s)
   - % of yield configured to donate
   - Projected annual donation (APY × principal × yieldPct)
   - Next donation date (lastTrigger + 7 days)

2. **Charity Allocations**
   - List of configured charities with weights
   - "Edit" → reopens `/discover` with existing config pre-filled

3. **Donation History** (`<DonationHistory />`)
   - Table reading past `DonationExecuted` events from the chain
   - Columns: Date, Charity, Amount (USDC), Tx Hash (link to explorer)

4. **Actions**
   - "Deposit More" → `/deposit`
   - "Withdraw Principal" → modal with amount input, calls `YieldVault.withdraw(amount)`
   - "Change Charity Split" → `/discover`

---

### `/charities` — Browse Registry

**File:** `app/app/charities/page.tsx`

**Purpose:** Full browsable directory of all approved charities.

**Content:**
- Fetch `charities.csv` via `/api/charities`
- Filter bar: category, search by name
- Grid of `<CharityCard />` components
- Each card links to charity website and shows on-chain badge (last tx date)

---

### `/admin` — Operator Panel

**File:** `app/app/admin/page.tsx`

**Purpose:** Operator-only management panel.

**Auth guard:** Check that connected wallet == deployer/owner address. Redirect to `/` if not.

**Sections:**

1. **Agent Proposals Queue** (`<AdminQueue />`)
   - Fetch from Supabase `proposals` table where `status = 'pending'`
   - Each proposal shows: name, category, wallet, score (0–100), dimension breakdown, rationale, recommendation
   - "Accept" button → calls `CharityRegistry.addCharity()` on-chain, then updates proposal status in Supabase
   - "Reject" button → updates proposal status in Supabase

2. **Run Agent**
   - "Run Researcher" → POST to Coolify webhook (`RESEARCHER_WEBHOOK_URL`)
   - Shows last run timestamp from Supabase

3. **Trigger Donation** (demo fallback)
   - Input: user address
   - "Trigger" button → calls `YieldVault.triggerWeeklyDonation(address)` directly (bypasses keeper timing check for demo — add `forceOverride` param to MockYieldVault)

4. **Registry Stats**
   - Active charities count
   - Pending proposals count
   - Total yield donated (sum of `DonationExecuted` event amounts)

---

## Components

### `<WalletConnector />`

**File:** `app/components/WalletConnector.tsx`

- Renders in navbar on all pages
- Shows: connect button (if not connected), or abbreviated address + disconnect (if connected)
- Uses `usePrivy()` for embedded wallet; `useAccount()` for external wallet state
- Dropdown: "Switch to embedded wallet" / "Switch to external wallet"

---

### `<OnrampWidget />`

**File:** `app/components/OnrampWidget.tsx`

- Wraps `@coinbase/onchainkit` `<OnrampButton />` or `<FundButton />`
- Props: `walletAddress: string`, `currency: "USDC"`, `amount?: number`
- Shows current USDC balance after successful purchase

```typescript
import { FundButton, getOnrampBuyUrl } from '@coinbase/onchainkit/fund';

export function OnrampWidget({ address }: { address: string }) {
  return (
    <FundButton
      fundingUrl={getOnrampBuyUrl({
        projectId: process.env.NEXT_PUBLIC_COINBASE_APP_ID!,
        addresses: { [address]: ['base'] },
        assets: ['USDC'],
        presetFiatAmount: 100,
        fiatCurrency: 'USD',
      })}
    />
  );
}
```

---

### `<CharityBot />`

**File:** `app/components/CharityBot.tsx`

- Streaming chat interface using the Vercel AI SDK `useChat()` hook
- Endpoint: `/api/chat`
- Parses `recommendations` JSON block from streamed response
- Calls `onRecommendations(recs)` callback when JSON is detected
- Shows typing indicator while streaming

```typescript
import { useChat } from 'ai/react';

export function CharityBot({ onRecommendations }) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    onFinish: (message) => {
      const jsonMatch = message.content.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        onRecommendations(parsed.recommendations);
      }
    },
  });

  // render message thread + input form
}
```

---

### `<CharityCard />`

**File:** `app/components/CharityCard.tsx`

Props:
```typescript
interface CharityCardProps {
  name: string;
  category: string;
  wallet: string;
  website?: string;
  description?: string;
  logoUrl?: string;
  lastOnchainTx?: string;    // ISO date string
  totalReceived?: number;     // USDC
  matchReason?: string;       // from chatbot
  suggestedPct?: number;      // from chatbot
  editable?: boolean;         // show % weight input
  weight?: number;
  onWeightChange?: (pct: number) => void;
}
```

- Shows "New" badge if `addedAt` within last 7 days
- Shows on-chain activity badge: green if tx within 30 days, yellow if 30–180 days, red if older
- If `editable=true`: show controlled number input for % weight

---

### `<YieldMeter />`

**File:** `app/components/YieldMeter.tsx`

- Reads `YieldVault.getYieldAccrued(userAddress)` via `useYieldVault()` hook
- Reads `principalSnapshot[userAddress]`
- Reads `donationConfig[userAddress]`
- Displays:
  - Animated counter: yield accrued in USDC (polls every 30s)
  - Circular progress showing % of yield earmarked for donation
  - "Next donation in X days" countdown
  - "Projected annual donation: $X.XX"

---

### `<DonationHistory />`

**File:** `app/components/DonationHistory.tsx`

- Uses `useYieldVault()` to fetch past `DonationExecuted` events via viem `getLogs`
- Filter: `fromBlock: deployBlock`, `toBlock: 'latest'`
- Renders table: Date | Charity | Amount | Tx Link
- Paginate if > 20 rows

---

### `<AdminQueue />`

**File:** `app/components/AdminQueue.tsx`

- Fetches proposals from Supabase where `status = 'pending'`
- For each proposal:
  - Score bar (colored 0–100)
  - Dimension breakdown (4 bars)
  - Rationale paragraph
  - Recommendation chip (Add/Hold/Reject)
  - Accept/Reject buttons
- "Accept" calls `useCharityRegistry().addCharity(charityData)` then `supabase.update(proposal, { status: 'accepted' })`

---

## Wagmi Hooks

### `useYieldVault()`

**File:** `app/hooks/useYieldVault.ts`

```typescript
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { YIELD_VAULT_ABI, YIELD_VAULT_ADDRESS } from '../lib/contracts';

export function useYieldVault() {
  const { address } = useAccount();

  const { data: yieldAccrued } = useReadContract({
    address: YIELD_VAULT_ADDRESS,
    abi: YIELD_VAULT_ABI,
    functionName: 'getYieldAccrued',
    args: [address],
    query: { refetchInterval: 30_000 },
  });

  const { data: principal } = useReadContract({
    address: YIELD_VAULT_ADDRESS,
    abi: YIELD_VAULT_ABI,
    functionName: 'principalSnapshot',
    args: [address],
  });

  const { data: donationConfig } = useReadContract({
    address: YIELD_VAULT_ADDRESS,
    abi: YIELD_VAULT_ABI,
    functionName: 'donationConfig',
    args: [address],
  });

  const { writeContractAsync: deposit } = useWriteContract();
  const { writeContractAsync: withdraw } = useWriteContract();
  const { writeContractAsync: setDonationConfig } = useWriteContract();
  const { writeContractAsync: triggerDonation } = useWriteContract();

  return {
    yieldAccrued,
    principal,
    donationConfig,
    deposit: (amount: bigint, adapter: `0x${string}`) =>
      deposit({ address: YIELD_VAULT_ADDRESS, abi: YIELD_VAULT_ABI, functionName: 'deposit', args: [amount, adapter] }),
    withdraw: (amount: bigint) =>
      withdraw({ address: YIELD_VAULT_ADDRESS, abi: YIELD_VAULT_ABI, functionName: 'withdraw', args: [amount] }),
    setDonationConfig: (yieldPct: bigint, charities: `0x${string}`[], weights: bigint[]) =>
      setDonationConfig({ address: YIELD_VAULT_ADDRESS, abi: YIELD_VAULT_ABI, functionName: 'setDonationConfig', args: [yieldPct, charities, weights] }),
    triggerDonation: (user: `0x${string}`) =>
      triggerDonation({ address: YIELD_VAULT_ADDRESS, abi: YIELD_VAULT_ABI, functionName: 'triggerWeeklyDonation', args: [user] }),
  };
}
```

---

### `useCharityRegistry()`

**File:** `app/hooks/useCharityRegistry.ts`

```typescript
export function useCharityRegistry() {
  const { data: charities } = useReadContract({
    address: CHARITY_REGISTRY_ADDRESS,
    abi: CHARITY_REGISTRY_ABI,
    functionName: 'getActiveCharities',
    query: { staleTime: 60_000 },
  });

  const { writeContractAsync: addCharity } = useWriteContract();

  return {
    charities,
    addCharity: (charity: CharityStruct) =>
      addCharity({ address: CHARITY_REGISTRY_ADDRESS, abi: CHARITY_REGISTRY_ABI, functionName: 'addCharity', args: [charity] }),
  };
}
```

---

### `useNewCharityListener()`

**File:** `app/hooks/useNewCharityListener.ts`

```typescript
import { useWatchContractEvent } from 'wagmi';

export function useNewCharityListener(onNew: (charity: CharityEvent) => void) {
  useWatchContractEvent({
    address: CHARITY_REGISTRY_ADDRESS,
    abi: CHARITY_REGISTRY_ABI,
    eventName: 'NewCharityAdded',
    onLogs: (logs) => {
      logs.forEach(log => onNew({
        wallet: log.args.wallet,
        name: log.args.name,
        category: log.args.category,
      }));
    },
  });
}
```

---

## API Routes

### `POST /api/chat`

**File:** `app/app/api/chat/route.ts`

Streaming chatbot endpoint.

```typescript
import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { getCharityCSV } from '../../lib/supabase';

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const { messages } = await req.json();
  const charityCsv = await getCharityCSV();  // fetch from Supabase Storage

  const systemPrompt = CHATBOT_SYSTEM_PROMPT.replace('{CHARITY_CSV_CONTENTS}', charityCsv);

  const result = await streamText({
    model: anthropic('claude-sonnet-4-5'),
    system: systemPrompt,
    messages,
    maxTokens: 1024,
  });

  return result.toDataStreamResponse();
}
```

### `GET /api/charities`

**File:** `app/app/api/charities/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase.storage
    .from('public')
    .download('charities.csv');

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const text = await data.text();
  return new Response(text, {
    headers: { 'Content-Type': 'text/csv', 'Cache-Control': 'max-age=300' },
  });
}
```

---

## `app/lib/contracts.ts`

```typescript
// Fill after contract deployment
export const YIELD_VAULT_ADDRESS = process.env.NEXT_PUBLIC_YIELD_VAULT_ADDRESS as `0x${string}`;
export const CHARITY_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_CHARITY_REGISTRY_ADDRESS as `0x${string}`;
export const MORPHO_ADAPTER_ADDRESS = process.env.NEXT_PUBLIC_MORPHO_ADAPTER_ADDRESS as `0x${string}`;

export { YIELD_VAULT_ABI } from './abis/YieldVault';
export { CHARITY_REGISTRY_ABI } from './abis/CharityRegistry';

// Copy ABIs from contracts/out/ after forge build
```

---

## Wagmi + Privy Provider Setup

**File:** `app/app/providers.tsx`

```typescript
'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { privyConfig } from '../lib/privy';

const wagmiConfig = createConfig({
  chains: [baseSepolia],
  transports: { [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL) },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider {...privyConfig}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}
```
