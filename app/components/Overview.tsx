"use client";
import { ArrowUpRight, Bot, ChevronRight, ShoppingCart, Workflow } from "lucide-react";
import type { Overview } from "@/lib/types";
import { SourceBadge, gbp } from "./ui";

export default function OverviewTab({ data, go }: { data: Overview | null; go: (t: "Lifecycle flows" | "Abandoned cart") => void }) {
  if (!data) return <div className="panel empty"><p>Loading workspace…</p></div>;
  const k = data.kpis;
  const max = Math.max(...data.campaigns.map((c) => c.revenue ?? 0), 1);
  return (
    <>
      <div className="banner"><ShoppingCart /><div><b>{data.mode === "live" ? "Live Klaviyo data" : data.mode === "partial" ? "Partly live Klaviyo data" : "Portfolio demonstration workspace"}</b><p>{data.mode === "demo" ? "Metrics are synthetic sample data, not actual store or Klaviyo results." : k.note ?? "Numbers come from your connected Klaviyo account."}</p>{data.warnings.map((w) => <p key={w}>⚠ {w}</p>)}</div><SourceBadge source={k.source} /></div>
      <section className="metrics">{[["Email-attributed revenue", gbp(k.revenue)], ["Flow revenue", gbp(k.flowRevenue)], ["Campaign revenue", gbp(k.campaignRevenue)], ["Orders attributed", k.orders.toLocaleString("en-GB")]].map((x) => <article className="metric" key={x[0]}><small>{x[0]}</small><h2>{x[1]}</h2><span>{k.revenue ? `${Math.round(((x[0].startsWith("Flow") ? k.flowRevenue : x[0].startsWith("Campaign") ? k.campaignRevenue : k.revenue) / k.revenue) * 100)}% of email revenue` : "—"}</span></article>)}</section>
      <div className="grid">
        <article className="panel"><div className="panelhead"><div><h3>Lifecycle automation</h3><p>{data.flows.length} flows · {data.flows[0]?.source === "klaviyo" ? "from Klaviyo" : "demo definitions"}</p></div><button className="textbtn" onClick={() => go("Lifecycle flows")}>View flows <ChevronRight /></button></div>
          {data.flows.slice(0, 5).map((f) => <div className="flowrow" key={f.id}><div className="flowicon"><Workflow /></div><div className="flowtext"><b>{f.name}</b><small>{f.trigger}</small></div><span className={f.status === "live" ? "status live" : "status"}>{f.status}</span></div>)}
        </article>
        <article className="panel insight"><div className="tag"><Bot /> GROWTH INSIGHT</div><h3>Cart recovery should lead with reassurance, not a discount.</h3><p>Test a message about artist quality and free preview approval before offering anything. Judge it on recovered orders, not opens. Try it in the simulator.</p><button onClick={() => go("Abandoned cart")}>Run the cart journey <ArrowUpRight /></button></article>
      </div>
      <article className="panel" style={{ marginTop: 16 }}><div className="panelhead"><div><h3>Revenue by campaign</h3><p>Attributed revenue</p></div></div>
        {data.campaigns.filter((c) => c.revenue !== undefined).length === 0 ? <p className="muted">Per-campaign revenue is not available for this source.</p> :
          data.campaigns.filter((c) => c.revenue !== undefined).map((c) => <div className="bar" key={c.id}><span>{c.name}</span><div><i style={{ width: `${((c.revenue ?? 0) / max) * 100}%` }} /></div><b>{gbp(c.revenue ?? 0)}</b></div>)}
      </article>
    </>
  );
}
