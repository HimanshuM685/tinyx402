import { NextRequest, NextResponse } from "next/server";
import { listRuns } from "@/lib/db";

export const runtime = "nodejs";

// Public payment log is fine: settlements are on-chain anyway. Inputs/outputs are never selected.
export async function GET(req: NextRequest) {
  const payer = req.nextUrl.searchParams.get("payer") ?? undefined;
  if (payer && !/^0x[0-9a-fA-F]{40}$/.test(payer)) return NextResponse.json({ error: "invalid payer" }, { status: 400 });
  const rows = await listRuns(payer, 100).catch(() => null);
  if (!rows) return NextResponse.json({ enabled: false, runs: [] });
  return NextResponse.json({
    enabled: true,
    runs: rows,
  });
}
