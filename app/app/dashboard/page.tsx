"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAccount } from "wagmi";
import { YieldMeter } from "@/components/YieldMeter";
import { DonationHistory } from "@/components/DonationHistory";

export default function DashboardPage() {
  const { authenticated, ready } = usePrivy();
  const { address } = useAccount();
  const router = useRouter();

  useEffect(() => {
    if (ready && !authenticated) router.push("/onboard");
  }, [ready, authenticated, router]);

  if (!ready || !authenticated) return null;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-8 py-4 flex items-center justify-between">
        <span className="font-bold text-green-700">YieldGive</span>
        <span className="text-sm text-gray-500 font-mono">
          {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""}
        </span>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-10 space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Your Dashboard</h1>

        <YieldMeter userAddress={address} />

        <DonationHistory userAddress={address} />

        <div className="flex gap-3">
          <button
            onClick={() => router.push("/deposit")}
            className="bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700"
          >
            Deposit More
          </button>
          <button
            onClick={() => router.push("/discover")}
            className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Change Charities
          </button>
        </div>
      </div>
    </main>
  );
}
