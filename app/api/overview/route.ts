import { NextResponse } from "next/server";
import { getOverview } from "@/lib/data";

export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json(await getOverview()); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Unable to load overview." }, { status: 500 }); }
}
