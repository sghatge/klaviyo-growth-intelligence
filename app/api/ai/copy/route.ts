import { NextRequest, NextResponse } from "next/server";
import { demoCopy, parseAiJson, runChecks, type CopyInput } from "@/lib/copy";

export async function POST(req: NextRequest) {
  const p = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const clip = (v: unknown, d: string, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : d);
  const input: CopyInput = {
    product: clip(p.product, "custom portrait", 120),
    audience: clip(p.audience, "art lovers", 120),
    offer: clip(p.offer, "", 160),
    tone: clip(p.tone, "Warm", 20),
  };
  const key = process.env.AI_GATEWAY_API_KEY, model = process.env.AI_GATEWAY_MODEL;
  if (!key || !model) return NextResponse.json(demoCopy(input));
  try {
    const r = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        model, temperature: 0.7,
        messages: [
          { role: "system", content: "You are a senior D2C lifecycle email strategist. Return only JSON with: subjects (array of 3 distinct subject lines, each 50 characters or fewer), preheader, headline, body, cta (max 4 words). Never invent discounts, guarantees, deadlines or customer facts. Use only the offer provided." },
          { role: "user", content: `Write a ${input.tone.toLowerCase()}, human marketing email for ${input.product}; audience: ${input.audience}; offer: ${input.offer || "none"}.` },
        ],
      }),
    });
    if (!r.ok) throw new Error(`AI Gateway returned ${r.status}`);
    const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = parseAiJson(String(j.choices?.[0]?.message?.content ?? ""));
    // Our own deterministic checks always run on top of the model output.
    return NextResponse.json({ mode: "ai", ...parsed, checks: runChecks(parsed, input.offer) });
  } catch (e) {
    return NextResponse.json({ ...demoCopy(input), warning: `${e instanceof Error ? e.message : "AI error"}. Showing demo copy instead.` });
  }
}
