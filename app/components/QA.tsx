"use client";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { CopyResult } from "@/lib/types";
import { CheckIcon } from "./Studio";

const MANUAL = ["Audience and consent eligibility verified in Klaviyo", "Suppression list and unsubscribe link present", "Links, UTM tracking and landing page tested", "Mobile and dark-mode rendering reviewed", "Offer terms and expiry confirmed with the business"];

export default function QA({ copy, goStudio }: { copy: CopyResult | null; goStudio: () => void }) {
  const [done, setDone] = useState<boolean[]>(MANUAL.map(() => false));
  const [approved, setApproved] = useState(false);
  if (!copy) return <div className="panel empty"><ShieldCheck /><p>Nothing to review yet. Generate a campaign in the Campaign studio first.</p><button className="primary" onClick={goStudio}>Open Campaign studio</button></div>;
  const blocking = copy.checks.filter((c) => c.status === "fail");
  const manualLeft = done.filter((d) => !d).length;
  const ready = blocking.length === 0 && manualLeft === 0;
  return (
    <div className="studio">
      <section className="panel">
        <div className="panelhead"><div><h3>Automatic checks</h3><p>Run on the generated copy: “{copy.subjects[0]}”</p></div></div>
        <ul className="checks">{copy.checks.map((c) => <li key={c.id}><CheckIcon s={c.status} /><span><b>{c.label}</b><small>{c.detail}</small></span></li>)}</ul>
      </section>
      <section className="panel qa">
        <div className="panelhead"><div><h3>Human review</h3><p>A person signs off. The AI never approves itself.</p></div></div>
        {MANUAL.map((m, i) => <label key={m}><input type="checkbox" checked={done[i]} onChange={(e) => { setApproved(false); setDone(done.map((d, j) => (j === i ? e.target.checked : d))); }} />{m}</label>)}
        <button className="primary" disabled={!ready} onClick={() => setApproved(true)}><ShieldCheck /> Approve for Klaviyo draft</button>
        {!ready && <small className="muted">{blocking.length ? `${blocking.length} blocking check${blocking.length > 1 ? "s" : ""} to fix. ` : ""}{manualLeft ? `${manualLeft} manual item${manualLeft > 1 ? "s" : ""} left.` : ""}</small>}
        {approved && <div className="result">Approved for a Klaviyo draft (demo). This app never sends campaigns or activates flows.</div>}
      </section>
    </div>
  );
}
