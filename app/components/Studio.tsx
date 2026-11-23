"use client";
import { useState } from "react";
import { Copy, ShieldCheck, Sparkles, XCircle, AlertTriangle, CheckCircle2, Mail } from "lucide-react";
import type { CopyResult } from "@/lib/types";
import type { CopyInput } from "@/lib/copy";

export const CheckIcon = ({ s }: { s: "pass" | "warn" | "fail" }) => s === "pass" ? <CheckCircle2 className="ck pass" /> : s === "warn" ? <AlertTriangle className="ck warn" /> : <XCircle className="ck fail" />;

export default function Studio({ input, setInput, copy, setCopy, goQA }: { input: CopyInput; setInput: (i: CopyInput) => void; copy: CopyResult | null; setCopy: (c: CopyResult | null) => void; goQA: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [subjectIdx, setSubjectIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const set = <K extends keyof CopyInput>(k: K, v: CopyInput[K]) => setInput({ ...input, [k]: v });

  async function generate() {
    setBusy(true); setErr(""); setSubjectIdx(0);
    try {
      const r = await fetch("/api/ai/copy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!r.ok) throw new Error(`Request failed (${r.status})`);
      setCopy(await r.json());
    } catch (e) { setErr(e instanceof Error ? e.message : "Copy generation failed."); }
    finally { setBusy(false); }
  }
  const text = copy ? `Subject: ${copy.subjects[subjectIdx]}\nPreheader: ${copy.preheader}\n\n${copy.headline}\n\n${copy.body}\n\n[${copy.cta}]` : "";
  const counts = copy ? { fail: copy.checks.filter((c) => c.status === "fail").length, warn: copy.checks.filter((c) => c.status === "warn").length } : null;

  return (
    <div className="studio">
      <section className="panel form">
        <label>PRODUCT<input value={input.product} onChange={(e) => set("product", e.target.value)} /></label>
        <label>TARGET AUDIENCE<select value={input.audience} onChange={(e) => set("audience", e.target.value)}>{["First-time subscribers", "Cart abandoners", "Repeat customers", "High-value customers", "Lapsed customers"].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>TONE<select value={input.tone} onChange={(e) => set("tone", e.target.value)}>{["Warm", "Premium", "Playful"].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>APPROVED OFFER (the only claim the AI may use)<input value={input.offer} onChange={(e) => set("offer", e.target.value)} /></label>
        <button className="primary" onClick={generate} disabled={busy}>{busy ? "Generating…" : <><Sparkles /> Generate 3 subject lines + email</>}</button>
        {err && <div className="notice err">{err}</div>}
        <small>Uses Vercel AI Gateway when configured, otherwise clearly labelled demo copy. Every result goes through the same deterministic checks.</small>
      </section>

      <section className="panel preview">
        <div className="panelhead"><div><h3>Campaign preview</h3><p>Pick a subject line to A/B test</p></div><Mail /></div>
        {copy ? <>
          <span className={copy.mode === "ai" ? "status live" : "status"}>{copy.mode === "ai" ? "AI GENERATED" : "DEMO GENERATED"}</span>
          {copy.warning && <div className="notice err">{copy.warning}</div>}
          <div className="subjects">{copy.subjects.map((s, i) => <button key={s} className={i === subjectIdx ? "on" : ""} onClick={() => setSubjectIdx(i)}><i>{String.fromCharCode(65 + i)}</i>{s}<small>{s.length} chars</small></button>)}</div>
          <div className="mail-card big"><small className="muted">{copy.preheader}</small><h3>{copy.headline}</h3><p>{copy.body}</p><span className="cta">{copy.cta}</span></div>
          <h4>Automatic checks {counts && <em>{counts.fail} blocking · {counts.warn} to review</em>}</h4>
          <ul className="checks">{copy.checks.map((c) => <li key={c.id}><CheckIcon s={c.status} /><span><b>{c.label}</b><small>{c.detail}</small></span></li>)}</ul>
          <div className="row"><button className="secondary" onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}><Copy /> {copied ? "Copied" : "Copy"}</button><button className="primary" onClick={goQA}><ShieldCheck /> Send to QA &amp; approval</button></div>
        </> : <div className="empty"><Sparkles /><p>Generate a campaign to see subject lines, the email and automatic checks here.</p></div>}
      </section>
    </div>
  );
}
