"use client";
import { useMemo, useState } from "react";
import { ShoppingCart } from "lucide-react";
import type { ProfileItem } from "@/lib/types";
import { SourceBadge, gbp } from "./ui";

export default function Customers({ profiles, runJourney }: { profiles: ProfileItem[]; runJourney: (p: ProfileItem) => void }) {
  const segments = useMemo(() => ["All", ...Array.from(new Set(profiles.map((p) => p.segment)))], [profiles]);
  const [seg, setSeg] = useState("All");
  const [sel, setSel] = useState<string | null>(null);
  const rows = profiles.filter((p) => seg === "All" || p.segment === seg);
  const chosen = profiles.find((p) => p.id === sel);
  return (
    <div className="panel">
      <div className="panelhead"><div><h3>Customer profiles</h3><p>Filter by segment, then run a customer through the cart journey</p></div>{profiles[0] && <SourceBadge source={profiles[0].source} />}</div>
      <div className="tabs">{segments.map((s) => <button key={s} className={s === seg ? "on" : ""} onClick={() => setSeg(s)}>{s}</button>)}</div>
      <div className="tablewrap"><table><thead><tr><th>CUSTOMER</th><th>EMAIL</th><th>SEGMENT</th><th>INTEREST</th><th>LTV</th></tr></thead><tbody>
        {rows.map((p) => <tr key={p.id} className={p.id === sel ? "sel" : ""} onClick={() => setSel(p.id)}><td>{p.name}</td><td>{p.email}</td><td>{p.segment}</td><td>{p.interest}</td><td>{p.ltv === null ? "—" : gbp(p.ltv)}</td></tr>)}
      </tbody></table></div>
      {chosen && <div className="note row"><span><b>{chosen.name}</b> · {chosen.segment} · {chosen.interest}</span><button className="primary" onClick={() => runJourney(chosen)}><ShoppingCart /> Run abandoned-cart journey for {chosen.name.split(" ")[0]}</button></div>}
    </div>
  );
}
