import { NextResponse } from "next/server";
import { getOverview } from "@/lib/data";
export const dynamic = "force-dynamic";
export async function GET() {
  const o = await getOverview();
  return NextResponse.json({ connected: o.klaviyo.connected, mode: o.mode, message: o.klaviyo.message, warnings: o.warnings }, { status: o.klaviyo.configured && !o.klaviyo.connected ? 502 : 200 });
}
