import { createClient } from "@supabase/supabase-js";
import { DEMO_CAMPAIGNS, DEMO_FLOWS, DEMO_PROFILES, kpisFromCampaigns } from "./demo-data";
import { isKlaviyoConfigured, klaviyoRequest } from "./klaviyo";
import type { CampaignItem, FlowItem, Kpis, Overview, ProfileItem } from "./types";

type JsonApi<A> = { data?: Array<{ id: string; attributes?: A }> };

async function liveFlows(): Promise<FlowItem[]> {
  const r = await klaviyoRequest<JsonApi<{ name?: string; status?: string; trigger_type?: string; archived?: boolean }>>("/flows/?page[size]=50");
  return (r.data ?? []).filter((f) => !f.attributes?.archived).map((f) => ({
    id: f.id,
    name: f.attributes?.name ?? "Untitled flow",
    status: f.attributes?.status ?? "unknown",
    trigger: f.attributes?.trigger_type ?? "Not specified",
    source: "klaviyo" as const,
  }));
}

async function liveCampaigns(): Promise<CampaignItem[]> {
  const q = encodeURIComponent("equals(messages.channel,'email')");
  const r = await klaviyoRequest<JsonApi<{ name?: string; status?: string; archived?: boolean }>>(`/campaigns/?filter=${q}&sort=-updated_at`);
  return (r.data ?? []).filter((c) => !c.attributes?.archived).slice(0, 20).map((c) => ({
    id: c.id, name: c.attributes?.name ?? "Untitled campaign", status: c.attributes?.status ?? "unknown", source: "klaviyo" as const,
  }));
}

type ProfileAttrs = { email?: string; first_name?: string; last_name?: string; properties?: Record<string, unknown>; predictive_analytics?: { historic_clv?: number } };

async function liveProfiles(): Promise<ProfileItem[]> {
  let r: JsonApi<ProfileAttrs>;
  try {
    r = await klaviyoRequest<JsonApi<ProfileAttrs>>("/profiles/?page[size]=25&additional-fields[profile]=predictive_analytics");
  } catch {
    r = await klaviyoRequest<JsonApi<ProfileAttrs>>("/profiles/?page[size]=25");
  }
  const str = (v: unknown) => (typeof v === "string" ? v : Array.isArray(v) ? v.join(", ") : "");
  return (r.data ?? []).map((p) => ({
    id: p.id,
    email: p.attributes?.email ?? "",
    name: [p.attributes?.first_name, p.attributes?.last_name].filter(Boolean).join(" ") || "Unnamed profile",
    segment: str(p.attributes?.properties?.segment) || "—",
    interest: str(p.attributes?.properties?.interest ?? p.attributes?.properties?.interests) || "—",
    ltv: typeof p.attributes?.predictive_analytics?.historic_clv === "number" ? p.attributes.predictive_analytics.historic_clv : null,
    source: "klaviyo" as const,
  }));
}

/** Best-effort 30-day revenue from Klaviyo reporting. Needs metrics:read and campaigns/flows read scopes. */
async function liveKpis(): Promise<Kpis> {
  const metrics = await klaviyoRequest<JsonApi<{ name?: string }>>("/metrics/");
  const placed = metrics.data?.find((m) => m.attributes?.name === "Placed Order");
  if (!placed) throw new Error("No “Placed Order” metric yet. Connect a store or send Placed Order events.");
  const key = process.env.KLAVIYO_PRIVATE_API_KEY!;
  const call = async (kind: "campaign" | "flow") => {
    const res = await fetch(`https://a.klaviyo.com/api/${kind}-values-reports/`, {
      method: "POST",
      headers: { Authorization: `Klaviyo-API-Key ${key}`, accept: "application/vnd.api+json", "content-type": "application/vnd.api+json", revision: process.env.KLAVIYO_API_REVISION || "2026-10-15" },
      body: JSON.stringify({ data: { type: `${kind}-values-report`, attributes: { timeframe: { key: "last_30_days" }, conversion_metric_id: placed.id, statistics: ["conversion_value", "conversion_uniques"] } } }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Klaviyo ${kind} report returned ${res.status}`);
    const j = (await res.json()) as { data?: { attributes?: { results?: Array<{ statistics?: { conversion_value?: number; conversion_uniques?: number } }> } } };
    const rows = j.data?.attributes?.results ?? [];
    return { value: rows.reduce((a, x) => a + (x.statistics?.conversion_value ?? 0), 0), orders: rows.reduce((a, x) => a + (x.statistics?.conversion_uniques ?? 0), 0) };
  };
  const [c, f] = await Promise.all([call("campaign"), call("flow")]);
  return { revenue: c.value + f.value, campaignRevenue: c.value, flowRevenue: f.value, orders: c.orders + f.orders, source: "klaviyo", note: "Last 30 days, Placed Order attribution" };
}

async function supabaseDemo(): Promise<{ profiles: ProfileItem[]; campaigns: CampaignItem[]; flows: FlowItem[] } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const [p, m, f] = await Promise.all([
    db.from("customer_profiles").select("id,email,first_name,last_name,segment,interests,lifetime_value").eq("is_demo", true).order("lifetime_value", { ascending: false }).limit(20),
    db.from("campaign_metrics").select("id,campaign_name,sent,clicks,orders,attributed_revenue").eq("is_demo", true).order("metric_date", { ascending: false }).limit(20),
    db.from("lifecycle_flows").select("flow_key,name,trigger_event,status,email_count").eq("is_demo", true).limit(20),
  ]);
  if (p.error || m.error || f.error || !p.data?.length || !m.data?.length || !f.data?.length) return null;
  return {
    profiles: p.data.map((r) => ({ id: r.id, email: r.email, name: [r.first_name, r.last_name].filter(Boolean).join(" "), segment: r.segment ?? "—", interest: (r.interests ?? []).join(", ") || "—", ltv: Number(r.lifetime_value), source: "supabase-demo" as const })),
    campaigns: m.data.map((r) => ({ id: r.id, name: r.campaign_name, status: DEMO_FLOW_NAMES.has(r.campaign_name) ? "flow" : "campaign", sent: r.sent, clicks: r.clicks, orders: r.orders, revenue: Number(r.attributed_revenue), source: "supabase-demo" as const })),
    flows: f.data.map((r) => ({ id: r.flow_key, name: r.name, status: r.status, trigger: r.trigger_event, emails: r.email_count, source: "supabase-demo" as const })),
  };
}
const DEMO_FLOW_NAMES = new Set(DEMO_FLOWS.map((f) => f.name));

export async function getOverview(): Promise<Overview> {
  const warnings: string[] = [];
  const demo = await supabaseDemo().catch(() => null);
  const base = {
    flows: demo?.flows ?? DEMO_FLOWS,
    campaigns: demo?.campaigns ?? DEMO_CAMPAIGNS,
    profiles: demo?.profiles ?? DEMO_PROFILES,
  };
  const demoKpis = kpisFromCampaigns(base.campaigns, demo ? "supabase-demo" : "static-demo");

  if (!isKlaviyoConfigured()) {
    return { mode: "demo", klaviyo: { configured: false, connected: false, message: "Demo mode. Add a restricted Klaviyo private key to connect a test account." }, kpis: demoKpis, ...base, warnings };
  }

  const [account, flows, campaigns, profiles, kpis] = await Promise.allSettled([
    klaviyoRequest<{ data?: unknown[] }>("/accounts/"), liveFlows(), liveCampaigns(), liveProfiles(), liveKpis(),
  ]);
  if (account.status === "rejected") {
    return { mode: "demo", klaviyo: { configured: true, connected: false, message: account.reason instanceof Error ? account.reason.message : "Connection failed." }, kpis: demoKpis, ...base, warnings: ["Could not authenticate with Klaviyo, showing demo data."] };
  }
  const pick = <T,>(r: PromiseSettledResult<T>, fallback: T, label: string): T => {
    if (r.status === "fulfilled") return r.value;
    warnings.push(`${label}: ${r.reason instanceof Error ? r.reason.message : "failed"} (showing demo data for this section)`);
    return fallback;
  };
  const liveF = pick(flows, null as FlowItem[] | null, "Flows");
  const liveC = pick(campaigns, null as CampaignItem[] | null, "Campaigns");
  const liveP = pick(profiles, null as ProfileItem[] | null, "Profiles");
  const liveK = pick(kpis, null as Kpis | null, "Revenue");
  const allLive = Boolean(liveF && liveC && liveP && liveK);
  return {
    mode: allLive ? "live" : "partial",
    klaviyo: { configured: true, connected: true, message: "Klaviyo authentication successful." },
    kpis: liveK ?? demoKpis,
    flows: liveF && liveF.length ? liveF : base.flows,
    campaigns: liveC && liveC.length ? liveC : base.campaigns,
    profiles: liveP && liveP.length ? liveP : base.profiles,
    warnings,
  };
}
