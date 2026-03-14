"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { parseUnits } from "viem";
import { useYieldVault } from "@/hooks/useYieldVault";

export default function DepositPage() {
  const { authenticated, ready } = usePrivy();
  const { address } = useAccount();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const { deposit } = useYieldVault();

  useEffect(() => {
    if (ready && !authenticated) router.push("/onboard");
  }, [ready, authenticated, router]);

  async function handleDeposit() {
    if (!amount || !address) return;
    setPending(true);
    try {
      const amountBigInt = parseUnits(amount, 6);
      await deposit(amountBigInt, process.env.NEXT_PUBLIC_MORPHO_ADAPTER_ADDRESS as `0x${string}`);
      router.push("/dashboard");
    } catch (err) {
      console.error("Deposit failed:", err);
      setPending(false);
    }
  }

  if (!ready || !authenticated) return null;

  const projectedAnnual =
    amount ? (parseFloat(amount) * 0.05 * 0.5).toFixed(2) : "0.00";

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Deposit USDC</h1>
        <p className="text-gray-600 text-sm mb-6">
          Deposits go into Morpho Blue on Base (~5% APY). Your principal is
          always safe — only yield is donated.
        </p>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">Protocol</span>
            <span className="font-medium">Morpho Blue</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-700">Current APY</span>
            <span className="font-medium text-green-700">~5.2%</span>
          </div>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-2">
          Amount (USDC)
        </label>
        <input
          type="number"
          placeholder="100"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full border rounded-xl px-4 py-3 text-lg font-mono mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
        />

        {amount && (
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">Projected annual donation</span>
              <span className="font-medium text-green-700">${projectedAnnual} USDC</span>
            </div>
            <div className="text-xs text-gray-500">
              Based on 5% APY, 50% yield donated
            </div>
          </div>
        )}

        <button
          onClick={handleDeposit}
          disabled={!amount || pending}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {pending ? "Depositing..." : "Deposit"}
        </button>
      </div>
    </main>
  );
}
