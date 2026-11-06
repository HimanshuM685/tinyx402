import { NextRequest, NextResponse } from "next/server";
import { TF, proxySse, safeId } from "@/lib/tinyfish";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel Hobby max; streams reconnect (Last-Event-ID)

// Free: follow a fill run. status / row / log frames, then done.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = req.nextUrl.searchParams.get("run") ?? "";
  if (!safeId(id) || !safeId(run)) return NextResponse.json({ error: "invalid id or run" }, { status: 400 });
  return proxySse(`${TF.agent}/v1/datasets/${id}/runs/${run}/events`, req.signal);
}
