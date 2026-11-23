import type { Source } from "@/lib/types";

export const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

const LABEL: Record<Source, string> = { klaviyo: "LIVE KLAVIYO", "supabase-demo": "SUPABASE DEMO DATA", "static-demo": "SYNTHETIC DEMO" };
export function SourceBadge({ source }: { source: Source }) {
  return <span className={source === "klaviyo" ? "status live" : "status"}>{LABEL[source]}</span>;
}
