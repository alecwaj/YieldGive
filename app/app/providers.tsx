"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const wagmiConfig = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(
      process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://sepolia.base.org"
    ),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ["email", "google", "wallet"],
        appearance: { theme: "light" },
        embeddedWallets: { createOnLogin: "users-without-wallets" },
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}
