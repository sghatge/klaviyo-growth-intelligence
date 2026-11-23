"use client";
import { ArrowUpRight, Workflow } from "lucide-react";
import type { FlowItem } from "@/lib/types";
import { SourceBadge } from "./ui";

export default function Flows({ flows, openCart }: { flows: FlowItem[]; openCart: () => void }) {
  return (
    <>
      <div className="flowcards">{flows.map((f) => {
        const cart = /cart|checkout/i.test(f.name + f.trigger);
        return <article className="panel flowcard" key={f.id}><div className="flowicon"><Workflow /></div><span className={f.status === "live" ? "status live" : "status"}>{f.status}</span><h3>{f.name}</h3><p>{f.trigger}</p><small>{f.emails ? `${f.emails} emails · ` : ""}Trigger-based journey</small>
          <div className="row" style={{ marginTop: 14 }}><SourceBadge source={f.source} />{cart && <button className="textbtn" onClick={openCart}>Simulate <ArrowUpRight /></button>}</div></article>;
      })}</div>
      <div className="note">Flow list is read-only. This app never creates, edits or activates Klaviyo flows.</div>
    </>
  );
}
