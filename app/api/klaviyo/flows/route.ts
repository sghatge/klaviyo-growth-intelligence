import { NextResponse } from "next/server";
import { getOverview } from "@/lib/data";
export const dynamic = "force-dynamic";
export async function GET() { const o = await getOverview(); return NextResponse.json({ mode: o.mode, flows: o.flows, warnings: o.warnings }); }
