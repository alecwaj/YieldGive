export interface Charity {
  id?: string;
  name: string;
  category: string;
  wallet_address: string;
  website?: string;
  description?: string;
  logo_url?: string;
  last_onchain_tx?: string;
  last_public_update?: string;
  total_received_usdc?: number;
  score?: number;
  score_breakdown?: ScoreBreakdown;
  rationale?: string;
  status?: "active" | "pending" | "rejected";
  added_at?: string;
  source?: "gitcoin" | "glodollar" | "giveth" | "karma_gap" | "manual" | "agent";
}

export interface ScoreBreakdown {
  onchain_activity: number;
  transparency: number;
  impact_efficacy: number;
  crypto_alignment: number;
}

export interface Proposal {
  id?: string;
  charity_data: Partial<Charity>;
  score: number;
  score_breakdown: ScoreBreakdown;
  rationale: string;
  recommendation: "Add" | "Hold" | "Reject";
  status: "pending" | "accepted" | "rejected";
  created_at?: string;
}

export interface ResearchQueueItem {
  id?: string;
  raw_data: Partial<Charity>;
  source: string;
  discovered_at?: string;
  scored: boolean;
}

export interface Report {
  id?: string;
  week_of: string;
  markdown_content: string;
  status: "draft" | "published";
  published_url?: string;
  created_at?: string;
}
