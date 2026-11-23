import type { CampaignItem, FlowItem, Kpis, ProfileItem } from "./types";

// Mirrors the seed rows in supabase/migrations so the demo is consistent with or without the database.
export const DEMO_FLOWS: FlowItem[] = [
  { id: "welcome", name: "Welcome series", status: "live", trigger: "Subscribed to email list", emails: 3, source: "static-demo" },
  { id: "cart", name: "Abandoned cart recovery", status: "live", trigger: "Started Checkout · no order", emails: 3, source: "static-demo" },
  { id: "browse", name: "Browse abandonment", status: "draft", trigger: "Viewed product · no cart", emails: 2, source: "static-demo" },
  { id: "post", name: "Post-purchase care", status: "live", trigger: "Placed order", emails: 3, source: "static-demo" },
  { id: "winback", name: "Customer win-back", status: "draft", trigger: "No purchase in 120 days", emails: 2, source: "static-demo" },
  { id: "review", name: "Review & UGC request", status: "live", trigger: "Order delivered", emails: 1, source: "static-demo" },
];

export const DEMO_PROFILES: ProfileItem[] = [
  { id: "p1", name: "Olivia Bennett", email: "olivia.bennett@example.test", segment: "Repeat customer", interest: "Pet portraits", ltv: 428, source: "static-demo" },
  { id: "p2", name: "Noah Williams", email: "noah.williams@example.test", segment: "High-value", interest: "Family portraits", ltv: 890, source: "static-demo" },
  { id: "p3", name: "Amelia Carter", email: "amelia.carter@example.test", segment: "Cart abandoner", interest: "Watercolour pet art", ltv: 0, source: "static-demo" },
  { id: "p4", name: "Oliver Smith", email: "oliver.smith@example.test", segment: "First-time buyer", interest: "Custom couple portrait", ltv: 149, source: "static-demo" },
  { id: "p5", name: "Isla Thompson", email: "isla.thompson@example.test", segment: "At-risk customer", interest: "Family canvas", ltv: 312, source: "static-demo" },
];

export const DEMO_CAMPAIGNS: CampaignItem[] = [
  { id: "m1", name: "Welcome series", status: "flow", sent: 12000, clicks: 1320, orders: 154, revenue: 8420, source: "static-demo" },
  { id: "m2", name: "Abandoned cart recovery", status: "flow", sent: 8600, clicks: 1190, orders: 172, revenue: 9760, source: "static-demo" },
  { id: "m3", name: "Post-purchase care", status: "flow", sent: 9200, clicks: 1480, orders: 204, revenue: 6940, source: "static-demo" },
  { id: "m4", name: "November studio edit", status: "campaign", sent: 24000, clicks: 1660, orders: 95, revenue: 16450, source: "static-demo" },
];

export function kpisFromCampaigns(rows: CampaignItem[], source: Kpis["source"]): Kpis {
  const flowRevenue = rows.filter((r) => r.status === "flow").reduce((a, r) => a + (r.revenue ?? 0), 0);
  const campaignRevenue = rows.filter((r) => r.status !== "flow").reduce((a, r) => a + (r.revenue ?? 0), 0);
  return {
    revenue: flowRevenue + campaignRevenue,
    flowRevenue,
    campaignRevenue,
    orders: rows.reduce((a, r) => a + (r.orders ?? 0), 0),
    source,
  };
}
