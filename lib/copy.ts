import type { CopyCheck, CopyResult } from "./types";

export type CopyInput = { product: string; audience: string; offer: string; tone: string };

const SPAM = ["free!!!", "act now", "limited time only", "winner", "100% free", "click here", "urgent", "!!!"];
const CLAIMS = ["guarantee", "guaranteed", "best in the world", "#1", "risk-free", "100%"];

export function runChecks(c: Pick<CopyResult, "subjects" | "preheader" | "headline" | "body" | "cta">, offer: string): CopyCheck[] {
  const s = c.subjects[0] ?? "";
  const all = `${s} ${c.preheader} ${c.headline} ${c.body}`.toLowerCase();
  const offerLc = offer.toLowerCase();
  const claim = CLAIMS.find((k) => all.includes(k) && !offerLc.includes(k));
  const spam = SPAM.find((k) => all.includes(k));
  const caps = s.length > 6 && s === s.toUpperCase();
  const pct = /\d+\s?%/.exec(all)?.[0];
  return [
    { id: "subject-len", label: "Subject length", status: s.length === 0 ? "fail" : s.length <= 50 ? "pass" : s.length <= 65 ? "warn" : "fail", detail: `${s.length} characters. Aim for 50 or fewer so it is not cut off on mobile.` },
    { id: "preheader", label: "Preheader", status: c.preheader.length >= 30 && c.preheader.length <= 110 ? "pass" : "warn", detail: `${c.preheader.length} characters. 30 to 110 works across inboxes.` },
    { id: "spam", label: "Spam-trigger language", status: spam || caps ? "warn" : "pass", detail: spam ? `Contains “${spam}”.` : caps ? "Subject is all caps." : "No common trigger phrases found." },
    { id: "claims", label: "Unverified claims", status: claim ? "fail" : "pass", detail: claim ? `“${claim}” appears but is not part of the approved offer.` : "No guarantees or superlatives beyond the approved offer." },
    { id: "discount", label: "Discount integrity", status: pct && !offerLc.includes(pct.replace(/\s/g, "")) && !offerLc.includes(pct) ? "fail" : "pass", detail: pct && !offerLc.includes(pct) ? `Mentions ${pct} but the offer field does not.` : "No invented discounts." },
    { id: "cta", label: "Single clear CTA", status: c.cta.trim().length > 0 && c.cta.length <= 28 ? "pass" : "warn", detail: c.cta ? `“${c.cta}”` : "Missing call to action." },
    { id: "personalization", label: "Personalization fallback", status: "warn", detail: "Copy has no merge tags yet. When adding {{ first_name|default:'there' }}, always set a fallback." },
  ];
}

const TONES: Record<string, { open: string; close: string }> = {
  Warm: { open: "Some moments deserve more than a place in your camera roll.", close: "Our artists create each piece with care, from first sketch to final detail." },
  Premium: { open: "Considered craft, made for the people and pets you love.", close: "Every piece is hand-finished by a professional artist and approved by you first." },
  Playful: { open: "Your best friend deserves to be framed.", close: "Pick a style, upload a photo and watch the magic happen. No art degree required." },
};

export function demoCopy(i: CopyInput): CopyResult {
  const p = i.product.trim() || "custom portrait";
  const pl = p.toLowerCase();
  const aud = i.audience.toLowerCase();
  const t = TONES[i.tone] ?? TONES.Warm;
  const offer = i.offer.trim();
  const byAudience: Record<string, string[]> = {
    "cart abandoners": [`Still thinking about your ${pl}?`, `Your ${pl} is waiting`, "Your free preview is still saved"],
    "repeat customers": [`A new style for your next ${pl}`, "Fresh from the studio, for you", `Back for another ${pl}?`],
    "high-value customers": [`First look: new ${pl} styles`, "Early access for our best customers", `A private preview of the ${pl} collection`],
    "lapsed customers": [`It's been a while. Here's what's new`, `We saved your spot for a new ${pl}`, "New styles since your last order"],
  };
  const subjects = byAudience[aud] ?? [`A ${pl} made just for you`, `Turn a favourite moment into a ${pl}`, "Meet your next keepsake"];
  const copy = {
    subjects,
    preheader: "Turn a favourite moment into artwork you'll keep forever.",
    headline: `Your ${pl}, turned into a keepsake`,
    body: `${t.open} ${t.close}${offer ? ` ${offer}.` : " Choose your style, upload your photo and let our artists take it from there."}`,
    cta: "Create your portrait",
  };
  return { mode: "demo", ...copy, checks: runChecks(copy, offer) };
}

export function parseAiJson(raw: string): Omit<CopyResult, "mode" | "checks"> {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const j = JSON.parse(cleaned) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const subjects = (Array.isArray(j.subjects) ? j.subjects : [j.subject]).map(str).filter(Boolean).slice(0, 3);
  const out = { subjects, preheader: str(j.preheader), headline: str(j.headline), body: str(j.body), cta: str(j.cta) };
  if (!out.subjects.length || !out.headline || !out.body || !out.cta) throw new Error("AI response was missing required fields.");
  return out;
}
