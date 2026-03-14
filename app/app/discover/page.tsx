"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CharityBot } from "@/components/CharityBot";
import { createClient } from "@supabase/supabase-js";

interface Recommendation {
  name: string;
  wallet: string;
  category: string;
  reason: string;
  suggested_pct: number;
  final_pct?: number;
}

export default function DiscoverPage() {
  const { user, authenticated, ready } = usePrivy();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ready && !authenticated) {
      router.push("/onboard");
    }
  }, [ready, authenticated, router]);

  async function handleConfigSaved(recs: Recommendation[]) {
    setSaving(true);
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const charityConfig = recs.map((r) => ({
        address: r.wallet,
        name: r.name,
        weight_pct: r.final_pct ?? r.suggested_pct,
      }));

      await supabase.from("user_configs").upsert({
        privy_user_id: user!.id,
        wallet_address: (user as any)?.wallet?.address ?? "",
        charities: charityConfig,
        updated_at: new Date().toISOString(),
      });

      router.push("/deposit");
    } catch (err) {
      console.error("Failed to save config:", err);
      setSaving(false);
    }
  }

  if (!ready || !authenticated) return null;

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <div className="border-b px-8 py-4 flex items-center justify-between">
        <span className="font-bold text-green-700">YieldGive</span>
        <div className="text-sm text-gray-500">Step 3 of 4 — Choose your charities</div>
      </div>

      <div className="flex-1 overflow-hidden p-6">
        <CharityBot onConfigSaved={handleConfigSaved} />
      </div>

      {saving && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-3" />
            <p className="text-gray-700">Saving your preferences...</p>
          </div>
        </div>
      )}
    </main>
  );
}
