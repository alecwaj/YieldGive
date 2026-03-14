"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAccount } from "wagmi";
import { AdminQueue } from "@/components/AdminQueue";

const OPERATOR_ADDRESS = process.env.NEXT_PUBLIC_OPERATOR_ADDRESS?.toLowerCase();

export default function AdminPage() {
  const { authenticated, ready } = usePrivy();
  const { address } = useAccount();
  const router = useRouter();

  useEffect(() => {
    if (ready && !authenticated) router.push("/onboard");
  }, [ready, authenticated, router]);

  const isOperator =
    !OPERATOR_ADDRESS || address?.toLowerCase() === OPERATOR_ADDRESS;

  if (!ready || !authenticated) return null;
  if (!isOperator) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600">
            This page is restricted to the operator wallet.
          </p>
        </div>
      </main>
    );
  }

  async function handleRunResearcher() {
    await fetch("/api/admin/run-researcher", { method: "POST" });
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-8 py-4">
        <span className="font-bold text-green-700">YieldGive Admin</span>
      </div>
      <div className="max-w-5xl mx-auto px-8 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            Operator Panel
          </h1>
          <button
            onClick={handleRunResearcher}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Run Researcher Agent
          </button>
        </div>

        <AdminQueue />
      </div>
    </main>
  );
}
