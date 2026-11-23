"use client";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { Overview } from "@/lib/types";

type St = { klaviyoKey: boolean; eventWrites: boolean; testDomains: string; aiGateway: boolean; supabase: boolean };

export default function Integrations({ data, refresh }: { data: Overview | null; refresh: () => void }) {
  const [st, setSt] = useState<St | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { fetch("/api/status").then((r) => r.json()).then(setSt).catch(() => setSt(null)); }, []);
  const pill = (on: boolean, yes: string, no: string) => <span className={on ? "status live" : "status"}>{on ? yes : no}</span>;
  return (
    <>
      <div className="integration"><div><b>Klaviyo</b><p>{data?.klaviyo.message ?? "Checking…"}{data?.warnings.map((w) => <><br />⚠ {w}</>)}</p>{pill(Boolean(data?.klaviyo.connected), "Connected · read", "Not connected · demo data")} {st && pill(st.eventWrites, `Event writes on · ${st.testDomains}`, "Event writes off")}</div><button className="secondary" onClick={() => { setMsg("Re-checking…"); refresh(); setTimeout(() => setMsg(""), 800); }}>Test connection</button></div>
      <div className="integration"><div><b>Supabase</b><p>Customer, campaign, flow and QA tables with RLS. The dashboard reads its synthetic rows when no Klaviyo key is set.</p>{st && pill(st.supabase, "Configured", "Not configured")} {data && pill(data.profiles[0]?.source === "supabase-demo", "Serving demo rows", "Using built-in demo rows")}</div><button className="secondary" onClick={() => fetch("/api/supabase/demo").then((r) => r.json()).then((j) => setMsg(j.connected ? `Supabase connected · ${j.profiles.length} demo profiles, ${j.flows.length} flows, ${j.metrics.length} metric rows` : j.message))}>Test database</button></div>
      <div className="integration"><div><b>AI Gateway</b><p>Server-side model access for campaign copy. Every output is re-checked by deterministic rules.</p>{st && pill(st.aiGateway, "Configured", "Demo copy fallback")}</div></div>
      {msg && <div className="notice">{msg}<button onClick={() => setMsg("")}>×</button></div>}
      <div className="security"><ShieldCheck /><div><b>Security by design</b><p>Keys stay server-side. Klaviyo access is read-only by default. The only write is the optional Started Checkout test event, limited to allowlisted test email domains. No campaign is ever sent and no flow is activated.</p></div></div>
    </>
  );
}
