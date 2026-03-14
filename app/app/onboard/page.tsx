"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function OnboardPage() {
  const { login, authenticated, ready } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) {
      router.push("/onramp");
    }
  }, [ready, authenticated, router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border p-10 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Get started</h1>
        <p className="text-gray-600 mb-8">
          Create a wallet or connect an existing one to start giving your yield.
        </p>
        <button
          onClick={login}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-medium hover:bg-green-700"
        >
          Sign in / Create wallet
        </button>
        <p className="text-xs text-gray-500 mt-4">
          Powered by Privy. Supports email, Google, MetaMask, and Coinbase Wallet.
        </p>
      </div>
    </main>
  );
}
