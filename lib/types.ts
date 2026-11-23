export type Source = "klaviyo" | "supabase-demo" | "static-demo";

export type FlowItem = { id: string; name: string; status: string; trigger: string; emails?: number; source: Source };
export type ProfileItem = { id: string; name: string; email: string; segment: string; interest: string; ltv: number | null; source: Source };
export type CampaignItem = { id: string; name: string; status: string; sent?: number; clicks?: number; orders?: number; revenue?: number; source: Source };

export type Kpis = {
  revenue: number;
  flowRevenue: number;
  campaignRevenue: number;
  orders: number;
  source: Source;
  note?: string;
};

export type Overview = {
  mode: "live" | "partial" | "demo";
  klaviyo: { configured: boolean; connected: boolean; message: string };
  kpis: Kpis;
  flows: FlowItem[];
  campaigns: CampaignItem[];
  profiles: ProfileItem[];
  warnings: string[];
};

export type CopyCheck = { id: string; label: string; status: "pass" | "warn" | "fail"; detail: string };
export type CopyResult = {
  mode: "ai" | "demo";
  subjects: string[];
  preheader: string;
  headline: string;
  body: string;
  cta: string;
  checks: CopyCheck[];
  warning?: string;
};
