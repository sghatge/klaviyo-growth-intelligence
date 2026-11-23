import { NextResponse } from "next/server";
import { eventWritePolicy, isKlaviyoConfigured } from "@/lib/klaviyo";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({
    klaviyoKey: isKlaviyoConfigured(),
    eventWrites: isKlaviyoConfigured() && process.env.KLAVIYO_ALLOW_EVENT_WRITES === "true",
    testDomains: (process.env.KLAVIYO_TEST_EMAIL_DOMAINS || "example.test"),
    aiGateway: Boolean(process.env.AI_GATEWAY_API_KEY && process.env.AI_GATEWAY_MODEL),
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    policyExample: eventWritePolicy("shopper@example.test").reason,
  });
}
