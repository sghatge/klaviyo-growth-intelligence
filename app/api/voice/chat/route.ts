import { NextRequest, NextResponse } from "next/server";
import { getOverview } from "@/lib/data";

export const dynamic = "force-dynamic";

const recentRequests = new Map<string, number[]>();
const MAX_MESSAGE = 1600;

function rateLimited(key: string) {
  const now = Date.now();
  const recent = (recentRequests.get(key) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 12) return true;
  recent.push(now);
  recentRequests.set(key, recent);
  return false;
}

function buildContext(data: Awaited<ReturnType<typeof getOverview>>) {
  const segmentCounts = data.profiles.reduce<Record<string, number>>((acc, p) => {
    const segment = p.segment || "Unclassified";
    acc[segment] = (acc[segment] ?? 0) + 1;
    return acc;
  }, {});
  return {
    dataMode: data.mode,
    klaviyoConnection: data.klaviyo.message,
    summary: {
      campaignCount: data.campaigns.length,
      flowCount: data.flows.length,
      profileCount: data.profiles.length,
      revenue: data.kpis.revenue,
      orders: data.kpis.orders,
      revenueSource: data.kpis.source,
      segments: segmentCounts,
    },
    campaigns: data.campaigns.slice(0, 8).map((c) => ({
      name: c.name, status: c.status, sent: c.sent ?? null,
      clicks: c.clicks ?? null, orders: c.orders ?? null, revenue: c.revenue ?? null,
    })),
    flows: data.flows.slice(0, 10).map((f) => ({
      name: f.name, status: f.status, trigger: f.trigger, emailCount: f.emails ?? null,
    })),
    privacy: "Customer names, email addresses and direct identifiers are intentionally excluded.",
  };
}

function fallbackAnswer(message: string, context: ReturnType<typeof buildContext>) {
  const q = message.toLowerCase();
  if (q.includes("abandon") || q.includes("cart") || q.includes("checkout")) {
    const flow = context.flows.find((f) => /cart|checkout/i.test(f.name));
    return flow
      ? `I found the ${flow.name} journey. Its current status is ${flow.status} and its trigger is ${flow.trigger}. This is ${context.dataMode === "demo" ? "demonstration" : "connected"} data. I can help you review its steps and QA considerations.`
      : "I don't see a specifically named abandoned-cart flow in the current dataset. We can still review the recommended journey design: checkout abandonment trigger, eligibility checks, delay, reminder message, purchase exit condition and suppression rules.";
  }
  if (q.includes("campaign")) return `The workspace currently contains ${context.summary.campaignCount} campaign records and ${context.summary.flowCount} lifecycle flows. The dashboard is in ${context.dataMode} mode. Ask me about a specific campaign or about improving subject lines, segmentation, testing and deliverability.`;
  if (q.includes("segment") || q.includes("customer")) return `The workspace has ${context.summary.profileCount} profile records. Segment counts are ${Object.entries(context.summary.segments).map(([k,v]) => `${k}: ${v}`).join(", ") || "not available"}. Individual customer details are not exposed to the voice assistant.`;
  if (q.includes("revenue") || q.includes("performance") || q.includes("metric")) return `The current reported revenue is ${context.summary.revenue.toLocaleString("en-IN")} across ${context.summary.orders} orders. The source is ${context.summary.revenueSource}. Please treat this as demonstration data unless the dashboard confirms a live Klaviyo connection.`;
  return `I'm ArtFlow AI Assistant. I can help with campaign performance, lifecycle flows, customer segments, abandoned-cart journeys and email QA. Your workspace currently has ${context.summary.campaignCount} campaigns and ${context.summary.flowCount} flows. What would you like to explore?`;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) return NextResponse.json({ error: "Too many requests. Please wait a minute and try again." }, { status: 429 });

  const body = await req.json().catch(() => ({})) as { message?: unknown; history?: unknown };
  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE) : "";
  if (!message) return NextResponse.json({ error: "Please say or type a question first." }, { status: 400 });

  try {
    const data = await getOverview();
    const context = buildContext(data);
    // Vercel automatically provides VERCEL_OIDC_TOKEN to deployments linked to a Vercel project.
    // An explicit Gateway key remains supported for non-Vercel/local deployments.
    const key = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
    const model = process.env.AI_GATEWAY_MODEL || "openai/gpt-4.1-mini";

    if (!key) {
      return NextResponse.json({ answer: fallbackAnswer(message, context), mode: "demo", dataMode: data.mode });
    }

    const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 350,
        messages: [
          {
            role: "system",
            content: "You are ArtFlow AI Assistant, a concise and practical CRM growth operations copilot. Answer in natural spoken language, usually 2-5 sentences. Use only the supplied workspace context for claims about current data. Clearly say when data is synthetic/demo or Klaviyo is not connected. Never invent metrics, campaign results, customer facts or integrations. Do not request or reveal customer personal data. You may explain and recommend; you cannot send campaigns, activate flows, modify records or perform external actions. For advice, be specific and explain the next useful step."
          },
          { role: "user", content: `Workspace context (JSON): ${JSON.stringify(context)}\n\nUser question: ${message}` }
        ]
      })
    });
    if (!response.ok) {
      return NextResponse.json({ answer: fallbackAnswer(message, context), mode: "fallback", dataMode: data.mode, warning: `AI Gateway unavailable (${response.status}); using local demo response.` });
    }
    const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const answer = String(json.choices?.[0]?.message?.content ?? "").trim();
    if (!answer) throw new Error("The AI service returned an empty response.");
    return NextResponse.json({ answer, mode: "ai", dataMode: data.mode });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Voice assistant request failed." }, { status: 503 });
  }
}
