"use client";
import { useCallback, useEffect, useState } from "react";
import { Activity, Image as ImageIcon, Mail, Plug, ShieldCheck, ShoppingCart, Users, Workflow } from "lucide-react";
import type { CopyResult, Overview, ProfileItem } from "@/lib/types";
import type { CopyInput } from "@/lib/copy";
import OverviewTab from "./components/Overview";
import Flows from "./components/Flows";
import Studio from "./components/Studio";
import Journey from "./components/Journey";
import Customers from "./components/Customers";
import QA from "./components/QA";
import Integrations from "./components/Integrations";
import VoiceAssistant from "./components/VoiceAssistant";

const TABS = ["Overview", "Abandoned cart", "Campaign studio", "Lifecycle flows", "Customers", "AI QA", "Integrations"] as const;
type Tab = (typeof TABS)[number];
const ICONS = [<Activity key="a" />, <ShoppingCart key="b" />, <Mail key="c" />, <Workflow key="d" />, <Users key="e" />, <ShieldCheck key="f" />, <Plug key="g" />];
const INTRO: Record<Tab, string> = {
  Overview: "Your customer lifecycle marketing at a glance.",
  "Abandoned cart": "Interactive demo: watch an abandoned-cart flow decide, wait, send and exit for different shoppers.",
  "Campaign studio": "Generate subject lines and email copy, with automatic checks on every result.",
  "Lifecycle flows": "Lifecycle automations mapped to Klaviyo flow concepts.",
  Customers: "Understand lifecycle stages, interests and customer value.",
  "AI QA": "Deterministic checks plus a human approval gate before anything reaches Klaviyo.",
  Integrations: "Server-side connections and what each one is allowed to do.",
};

export default function Home() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [data, setData] = useState<Overview | null>(null);
  const [copy, setCopy] = useState<CopyResult | null>(null);
  const [input, setInput] = useState<CopyInput>({ product: "Custom pet portrait", audience: "Cart abandoners", offer: "Free digital preview with every order", tone: "Warm" });
  const [prefill, setPrefill] = useState<{ firstName: string; email: string } | null>(null);

  const load = useCallback(() => { fetch("/api/overview").then((r) => r.json()).then((j) => { if (!j.error) setData(j); }).catch(() => undefined); }, []);
  useEffect(load, [load]);

  const live = data?.mode === "live" || data?.mode === "partial";
  const runJourney = (p: ProfileItem) => { setPrefill({ firstName: p.name.split(" ")[0], email: p.email }); setTab("Abandoned cart"); };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><div className="brand-icon"><ImageIcon /></div><div><b>artflow<span>ai</span></b><small>GROWTH INTELLIGENCE</small></div></div>
        <div className="workspace"><div className="avatar">A</div><div><b>ArtFlow Studio</b><small>D2C DEMO WORKSPACE</small></div></div>
        <label className="navlabel">WORKSPACE</label>
        <nav>{TABS.map((t, i) => <button key={t} className={tab === t ? "selected" : ""} onClick={() => setTab(t)}>{ICONS[i]}{t}</button>)}</nav>
        <div className="sidefoot"><span className={live ? "live-dot" : "demo-dot"} /><b>{live ? "Klaviyo connected" : "Demo workspace"}</b><small>{data?.klaviyo.message ?? "Checking…"}</small></div>
      </aside>
      <main>
        <header><div><small>ARTFLOW STUDIO　/　{tab.toUpperCase()}</small><h1>{tab === "Overview" ? "Growth workspace" : tab}</h1></div><div className="topright"><span className={live ? "pill live" : "pill"}>{live ? "LIVE KLAVIYO" : "SYNTHETIC DEMO"}</span></div></header>
        <p className="intro">{INTRO[tab]}</p>
        {tab === "Overview" && <OverviewTab data={data} go={setTab} />}
        {tab === "Abandoned cart" && <Journey prefill={prefill} />}
        {tab === "Campaign studio" && <Studio input={input} setInput={setInput} copy={copy} setCopy={setCopy} goQA={() => setTab("AI QA")} />}
        {tab === "Lifecycle flows" && <Flows flows={data?.flows ?? []} openCart={() => setTab("Abandoned cart")} />}
        {tab === "Customers" && <Customers profiles={data?.profiles ?? []} runJourney={runJourney} />}
        {tab === "AI QA" && <QA copy={copy} goStudio={() => setTab("Campaign studio")} />}
        {tab === "Integrations" && <Integrations data={data} refresh={load} />}
        <VoiceAssistant />
        <footer>ARTFLOW AI · KLAVIYO GROWTH INTELLIGENCE <span>Portfolio prototype · {live ? "Live Klaviyo read access" : "Synthetic demo data"}</span></footer>
      </main>
    </div>
  );
}
