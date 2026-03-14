import { createClient } from "@supabase/supabase-js";
import type { ResearchQueueItem, Proposal, Charity, Report } from "./types.js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function writeToResearchQueue(
  items: Omit<ResearchQueueItem, "id">[]
) {
  const { error } = await supabase.from("research_queue").insert(items);
  if (error) throw error;
}

export async function getUnscoredQueue(): Promise<ResearchQueueItem[]> {
  const { data, error } = await supabase
    .from("research_queue")
    .select("*")
    .eq("scored", false);
  if (error) throw error;
  return data ?? [];
}

export async function markQueueItemScored(id: string) {
  await supabase
    .from("research_queue")
    .update({ scored: true })
    .eq("id", id);
}

export async function writeProposal(proposal: Omit<Proposal, "id">) {
  const { error } = await supabase.from("proposals").insert(proposal);
  if (error) throw error;
}

export async function getActiveCharities(): Promise<Charity[]> {
  const { data, error } = await supabase
    .from("charities")
    .select("*")
    .eq("status", "active");
  if (error) throw error;
  return data ?? [];
}

export async function upsertCharity(charity: Partial<Charity>) {
  const { error } = await supabase
    .from("charities")
    .upsert(charity, { onConflict: "wallet_address" });
  if (error) throw error;
}

export async function writeReport(report: Omit<Report, "id">) {
  const { error } = await supabase.from("reports").insert(report);
  if (error) throw error;
}

export async function uploadCharitiesCSV(csvContent: string) {
  const { error } = await supabase.storage
    .from("public")
    .upload("charities.csv", Buffer.from(csvContent), {
      contentType: "text/csv",
      upsert: true,
    });
  if (error) throw error;
}

export async function uploadReportFile(filename: string, content: string) {
  const { error } = await supabase.storage
    .from("public")
    .upload(`reports/${filename}`, Buffer.from(content), {
      contentType: "text/markdown",
      upsert: true,
    });
  if (error) throw error;
}
