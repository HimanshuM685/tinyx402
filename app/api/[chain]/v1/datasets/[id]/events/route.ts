import { NextRequest, NextResponse } from "next/server";
import { TF, proxySse, safeId } from "@/lib/tinyfish";
import { requireChain } from "@/lib/chain-guard";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel Hobby max; streams reconnect (Last-Event-ID)

// Free: follow a fill run. status / row / log frames, then done.
// Free follow-up. Chain-agnostic: it only proxies by id, so the same resource reads the same
// under any chain prefix. The prefix exists so the URL matches the paid call that created it.
export async function GET(req: NextRequest, ctx: { params: Promise<{ chain: string; id: string }> }) {
  const bad = await requireChain(ctx);
  if (bad) return bad; // real chain slug, or every resource gains unlimited URL aliases
  const { id } = await ctx.params;
  const run = req.nextUrl.searchParams.get("run") ?? "";
  if (!safeId(id) || !safeId(run)) return NextResponse.json({ error: "invalid id or run" }, { status: 400 });
  return proxySse(`${TF.agent}/v1/datasets/${id}/runs/${run}/events`, req.signal);
}
