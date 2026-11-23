"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock, Copy, Filter, GitBranch, LogOut, Mail, Pause, Play, RotateCcw, Send, ShoppingCart, Zap } from "lucide-react";
import { JOURNEY_NODES, SIM_END_MIN, fmtMinutes, simulate, type JourneyNode, type SimInput } from "@/lib/journey";
import { gbp } from "./ui";

const PRODUCTS = [
  { name: "Watercolour pet portrait", price: 89 },
  { name: "Couple portrait", price: 149 },
  { name: "Family portrait canvas", price: 189 },
  { name: "Pet portrait, hand-framed", price: 240 },
];
const FRAMING = 45;

const PRESETS: Array<{ label: string; hint: string; apply: Partial<State> }> = [
  { label: "Recovered by email 2", hint: "Ignores email 1, buys the next day", apply: { consent: true, buys: true, orderMin: 27 * 60, productIdx: 2, framing: false } },
  { label: "Never returns", hint: "High-value cart, sees all 3 emails", apply: { consent: true, buys: false, productIdx: 3, framing: false } },
  { label: "Buys on their own", hint: "Orders in 20 min. Organic, not recovered", apply: { consent: true, buys: true, orderMin: 20, productIdx: 0, framing: false } },
  { label: "No email consent", hint: "Filter blocks every send", apply: { consent: false, buys: true, orderMin: 600, productIdx: 1, framing: false } },
];

type State = { firstName: string; email: string; productIdx: number; framing: boolean; consent: boolean; buys: boolean; orderMin: number; offer: string };

const ICON: Record<JourneyNode["kind"], React.ReactNode> = {
  trigger: <Zap />, filter: <Filter />, wait: <Clock />, check: <GitBranch />, email: <Mail />, split: <GitBranch />, exit: <LogOut />,
};

export default function Journey({ prefill }: { prefill?: { firstName: string; email: string } | null }) {
  const [s, setS] = useState<State>({ firstName: "Amelia", email: "amelia.carter@example.test", productIdx: 2, framing: false, consent: true, buys: true, orderMin: 27 * 60, offer: "Complimentary premium framing upgrade" });
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [push, setPush] = useState<{ busy: boolean; result?: Record<string, unknown> }>({ busy: false });
  const set = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }));

  useEffect(() => { if (prefill) setS((p) => ({ ...p, firstName: prefill.firstName, email: prefill.email })); }, [prefill]);

  const cartValue = PRODUCTS[s.productIdx].price + (s.framing ? FRAMING : 0);
  const input: SimInput = useMemo(() => ({ firstName: s.firstName, productName: PRODUCTS[s.productIdx].name, cartValue, consent: s.consent, orderAtMin: s.buys ? s.orderMin : null, offerText: s.offer }), [s, cartValue]);
  const sim = useMemo(() => simulate(input), [input]);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => setTime((t) => { if (t + 45 >= SIM_END_MIN) { setPlaying(false); return SIM_END_MIN; } return t + 45; }), 40);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing]);

  const nodeTime = (id: string) => sim.events.find((e) => e.node === id)?.t;
  const entered = sim.path.filter((id) => (nodeTime(id) ?? Infinity) <= time);
  const current = entered[entered.length - 1];
  const visibleEvents = sim.events.filter((e) => e.t <= time);
  const visibleEmails = sim.emails.filter((e) => e.t <= time);
  const orderVisible = s.buys && s.orderMin <= time;
  const recoveredNow = orderVisible && sim.attributedTo ? sim.recovered : 0;
  const shownEmail = visibleEmails.find((e) => e.node === picked) ?? visibleEmails[visibleEmails.length - 1];

  const stateOf = (id: string) => {
    if (!sim.path.includes(id)) return "skipped";
    if (!entered.includes(id)) return "pending";
    return id === current ? "active" : "done";
  };
  const card = (n: JourneyNode) => {
    const st = stateOf(n.id), t = nodeTime(n.id);
    return (
      <div key={n.id} className={`jnode ${n.kind} ${st}`}>
        <div className="jicon">{ICON[n.kind]}</div>
        <div className="jtext"><b>{n.title}</b>{n.detail && <small>{n.detail}</small>}</div>
        <span className="jtime">{st === "skipped" ? "not on path" : t !== undefined ? `T+${fmtMinutes(t)}` : ""}</span>
      </div>
    );
  };
  const byId = (id: string) => JOURNEY_NODES.find((n) => n.id === id)!;
  const rows: Array<string[]> = [["trigger"], ["filter"], ["wait1"], ["email1"], ["wait2"], ["email2"], ["wait3"], ["split"], ["email3a", "email3b"], ["exit"]];

  function preset(p: (typeof PRESETS)[number]) { setS((x) => ({ ...x, ...p.apply })); setTime(0); setPicked(null); setPlaying(true); }
  function play() { if (time >= SIM_END_MIN) setTime(0); setPlaying((p) => !p); }

  async function pushToKlaviyo() {
    setPush({ busy: true });
    try {
      const r = await fetch("/api/journey/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: s.email, productName: input.productName, cartValue }) });
      setPush({ busy: false, result: await r.json() });
    } catch { setPush({ busy: false, result: { error: "Request failed." } }); }
  }

  const status = !s.consent ? { t: "Blocked by consent filter", c: "bad" } : orderVisible ? (sim.organic ? { t: "Organic order, flow not credited", c: "warn" } : { t: `Recovered ${gbp(recoveredNow)}`, c: "good" }) : time >= (sim.events[sim.events.length - 1]?.t ?? 0) && !s.buys ? { t: "Sequence complete, no order", c: "warn" } : { t: time === 0 ? "Press play to start" : "In journey…", c: "" };

  return (
    <div className="jwrap">
      <section className="panel">
        <div className="panelhead"><div><h3>1 · Set the scene</h3><p>Pick a shopper scenario, or tune every input yourself.</p></div><ShoppingCart /></div>
        <div className="presets">{PRESETS.map((p) => <button key={p.label} className="preset" onClick={() => preset(p)}><b>{p.label}</b><small>{p.hint}</small></button>)}</div>
        <div className="jform">
          <label>FIRST NAME<input value={s.firstName} placeholder="Leave empty to test the fallback" onChange={(e) => set("firstName", e.target.value)} /></label>
          <label>PRODUCT<select value={s.productIdx} onChange={(e) => set("productIdx", Number(e.target.value))}>{PRODUCTS.map((p, i) => <option key={p.name} value={i}>{p.name} · £{p.price}</option>)}</select></label>
          <label className="check"><input type="checkbox" checked={s.framing} onChange={(e) => set("framing", e.target.checked)} /> Add hand-framing (+£{FRAMING}) <em>Cart: {gbp(cartValue)}</em></label>
          <label className="check"><input type="checkbox" checked={s.consent} onChange={(e) => set("consent", e.target.checked)} /> Subscribed to marketing email</label>
          <label className="check"><input type="checkbox" checked={s.buys} onChange={(e) => set("buys", e.target.checked)} /> Shopper eventually buys</label>
          {s.buys && <label>BUYS AFTER <b>{fmtMinutes(s.orderMin)}</b><input type="range" min={5} max={SIM_END_MIN - 15} step={5} value={s.orderMin} onChange={(e) => set("orderMin", Number(e.target.value))} /></label>}
          <label>VALUE-ADD FOR HIGH-VALUE CARTS (≥ £150)<input value={s.offer} onChange={(e) => set("offer", e.target.value)} /></label>
        </div>
      </section>

      <section className="panel jtimeline">
        <div className="panelhead"><div><h3>2 · Run the journey</h3><p>Abandoned cart flow, driven by Started Checkout. Scrub or press play.</p></div>
          <div className="jctrl"><button className="primary" onClick={play}>{playing ? <><Pause /> Pause</> : <><Play /> {time >= SIM_END_MIN ? "Replay" : "Play"}</>}</button><button className="secondary" onClick={() => { setPlaying(false); setTime(0); setPicked(null); }}><RotateCcw /> Reset</button></div></div>
        <div className="scrub">
          <input type="range" min={0} max={SIM_END_MIN} step={15} value={time} onChange={(e) => { setPlaying(false); setTime(Number(e.target.value)); }} aria-label="Time since checkout started" />
          <div className="marks">
            {sim.emails.map((e) => <i key={e.node} className="mark mail" style={{ left: `${(e.t / SIM_END_MIN) * 100}%` }} title={`Email at ${fmtMinutes(e.t)}`} />)}
            {s.buys && <i className="mark order" style={{ left: `${(s.orderMin / SIM_END_MIN) * 100}%` }} title={`Order at ${fmtMinutes(s.orderMin)}`} />}
          </div>
          <div className="scrubmeta"><b>T+{fmtMinutes(time)}</b><span><i className="dot mail" /> email sent</span><span><i className="dot order" /> order placed</span></div>
        </div>
        <div className="jstats">
          <div><small>EMAILS SENT</small><b>{visibleEmails.length}</b></div>
          <div><small>RECOVERED REVENUE</small><b>{gbp(recoveredNow)}</b></div>
          <div className={`jstatus ${status.c}`}><small>STATUS</small><b>{status.t}</b></div>
        </div>
        <div className="jflow">
          {rows.map((ids) => ids.length === 1 ? card(byId(ids[0])) : <div className="jbranch" key={ids.join()}>{ids.map((id) => card(byId(id)))}</div>)}
        </div>
      </section>

      <section className="jside">
        <div className="panel">
          <div className="panelhead"><div><h3>3 · What the shopper receives</h3><p>{visibleEmails.length ? "Click an email to open it." : "Nothing sent yet."}</p></div><Mail /></div>
          {visibleEmails.length > 0 && <div className="tabs">{visibleEmails.map((e, i) => <button key={e.node} className={shownEmail?.node === e.node ? "on" : ""} onClick={() => setPicked(e.node)}>Email {i + 1}</button>)}</div>}
          {shownEmail ? <div className="mail-card"><small>Subject</small><h4>{shownEmail.email.subject}</h4><small className="muted">{shownEmail.email.preheader}</small><hr />{shownEmail.email.body.split("\n\n").map((p) => <p key={p}>{p}</p>)}<span className="cta">{shownEmail.email.cta}</span></div> : <div className="empty small"><Mail /><p>Run the journey to see the emails land.</p></div>}
        </div>
        <div className="panel">
          <div className="panelhead"><div><h3>Event log</h3><p>What Klaviyo would record</p></div></div>
          <ul className="log">{visibleEvents.length === 0 && <li className="muted">No events yet.</li>}{[...visibleEvents].reverse().map((e, i) => <li key={`${e.node}-${i}`} className={e.kind}><time>T+{fmtMinutes(e.t)}</time><span><b>{e.title}</b>{e.detail && <small>{e.detail}</small>}</span></li>)}</ul>
        </div>
        <div className="panel">
          <div className="panelhead"><div><h3>Send it to real Klaviyo</h3><p>Fires a Started Checkout event for this shopper.</p></div><Send /></div>
          <label className="miniLabel">TEST EMAIL<input value={s.email} onChange={(e) => set("email", e.target.value)} /></label>
          <button className="primary" disabled={push.busy} onClick={pushToKlaviyo}>{push.busy ? "Sending…" : "Send Started Checkout"}</button>
          {push.result && <div className={`pushresult ${push.result.mode === "sent" ? "ok" : ""}`}>
            <b>{push.result.mode === "sent" ? <><CheckCircle2 /> Accepted by Klaviyo</> : push.result.mode === "dry-run" ? "Dry run, nothing was sent" : "Not sent"}</b>
            <p>{String(push.result.reason ?? push.result.message ?? push.result.error ?? "")}</p>
            {push.result.payload !== undefined && <><button className="textbtn" onClick={() => navigator.clipboard?.writeText(JSON.stringify(push.result!.payload, null, 2))}><Copy /> Copy payload</button><pre>{JSON.stringify(push.result.payload, null, 2)}</pre></>}
          </div>}
          <small className="muted">Writes only happen for allowlisted test domains with event writes enabled on the server. Otherwise you get the exact payload.</small>
        </div>
      </section>
    </div>
  );
}
