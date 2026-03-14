"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useCharityRegistry } from "@/hooks/useCharityRegistry";

interface Proposal {
  id: string;
  charity_data: any;
  score: number;
  score_breakdown: any;
  rationale: string;
  recommendation: string;
  status: string;
}

export function AdminQueue() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const { addCharity } = useCharityRegistry();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function fetchProposals() {
    const { data } = await supabase
      .from("proposals")
      .select("*")
      .eq("status", "pending")
      .order("score", { ascending: false });
    setProposals(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchProposals();
  }, []);

  async function handleAccept(proposal: Proposal) {
    try {
      const c = proposal.charity_data;
      await addCharity({
        name: c.name,
        category: c.category,
        wallet: c.wallet_address as `0x${string}`,
        metadataURI: c.website ?? "",
        active: true,
        addedAt: 0n,
      });
      await supabase
        .from("proposals")
        .update({ status: "accepted" })
        .eq("id", proposal.id);
      setProposals((p) => p.filter((x) => x.id !== proposal.id));
    } catch (err) {
      console.error("Accept failed:", err);
    }
  }

  async function handleReject(proposal: Proposal) {
    await supabase
      .from("proposals")
      .update({ status: "rejected" })
      .eq("id", proposal.id);
    setProposals((p) => p.filter((x) => x.id !== proposal.id));
  }

  const scoreColor = (score: number) =>
    score >= 70 ? "text-green-700" : score >= 40 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">
        Proposals Queue ({proposals.length} pending)
      </h2>

      {loading && <div className="text-gray-500 text-sm">Loading...</div>}

      {!loading && proposals.length === 0 && (
        <div className="text-gray-500 text-sm bg-white border rounded-xl p-6 text-center">
          No pending proposals. Run the Researcher agent to discover new orgs.
        </div>
      )}

      {proposals.map((p) => (
        <div key={p.id} className="bg-white border rounded-xl p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">
                {p.charity_data?.name}
              </h3>
              <span className="text-xs text-gray-500">
                {p.charity_data?.category} · {p.charity_data?.wallet_address}
              </span>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${scoreColor(p.score)}`}>
                {p.score}
              </div>
              <div className="text-xs text-gray-500">/ 100</div>
            </div>
          </div>

          {p.score_breakdown && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(p.score_breakdown).map(([k, v]) => (
                <div key={k} className="flex justify-between bg-gray-50 rounded-lg px-3 py-1.5">
                  <span className="text-gray-600 capitalize">
                    {k.replace(/_/g, " ")}
                  </span>
                  <span className="font-medium">{v as number}/10</span>
                </div>
              ))}
            </div>
          )}

          <p className="text-sm text-gray-700">{p.rationale}</p>

          <div className="flex items-center gap-3 pt-1">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                p.recommendation === "Add"
                  ? "bg-green-100 text-green-700"
                  : p.recommendation === "Hold"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {p.recommendation}
            </span>
            <div className="flex-1" />
            <button
              onClick={() => handleReject(p)}
              className="text-sm text-red-600 hover:underline"
            >
              Reject
            </button>
            <button
              onClick={() => handleAccept(p)}
              className="bg-green-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-green-700"
            >
              Accept → Add to Registry
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
