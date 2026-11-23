import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { eventWritePolicy, klaviyoPost } from "@/lib/klaviyo";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase().slice(0, 200) : "";
  const product = typeof b.productName === "string" ? b.productName.slice(0, 120) : "Custom portrait";
  const value = typeof b.cartValue === "number" && b.cartValue > 0 && b.cartValue < 10_000 ? b.cartValue : 0;
  if (!EMAIL.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!value) return NextResponse.json({ error: "Cart value must be between 1 and 9999." }, { status: 400 });

  const payload = {
    data: {
      type: "event",
      attributes: {
        properties: { ItemNames: [product], Items: [{ ProductName: product, ItemPrice: value, Quantity: 1 }], CheckoutURL: "https://example.test/checkout", source: "artflow-portfolio-demo" },
        value,
        unique_id: randomUUID(),
        time: new Date().toISOString(),
        metric: { data: { type: "metric", attributes: { name: "Started Checkout" } } },
        profile: { data: { type: "profile", attributes: { email } } },
      },
    },
  };

  const policy = eventWritePolicy(email);
  if (!policy.allowed) return NextResponse.json({ mode: "dry-run", reason: policy.reason, endpoint: "POST https://a.klaviyo.com/api/events", payload });
  try {
    const r = await klaviyoPost("/events/", payload);
    if (r.status === 202) return NextResponse.json({ mode: "sent", status: 202, message: "Klaviyo accepted the event. It appears on the profile timeline within a minute.", payload });
    return NextResponse.json({ mode: "error", status: r.status, message: r.text, payload }, { status: 502 });
  } catch (e) {
    return NextResponse.json({ mode: "error", message: e instanceof Error ? e.message : "Request failed", payload }, { status: 502 });
  }
}
