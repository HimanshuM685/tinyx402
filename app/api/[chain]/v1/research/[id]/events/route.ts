import { NextResponse } from "next/server";
import { TF, proxySse, safeId } from "@/lib/tinyfish";
import { requireChain } from "@/lib/chain-guard";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel Hobby max; streams reconnect (Last-Event-ID)

// Free: live progress events. Reconnect with Last-Event-ID; disconnecting does not cancel the run.
// Free follow-up. Chain-agnostic: it only proxies by id, so the same resource reads the same
// under any chain prefix. The prefix exists so the URL matches the paid call that created it.
export async function GET(req: Request, ctx: { params: Promise<{ chain: string; id: string }> }) {
  const bad = await requireChain(ctx);
  if (bad) return bad; // real chain slug, or every resource gains unlimited URL aliases
  const { id } = await ctx.params;
  if (!safeId(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const last = req.headers.get("last-event-id");
  return proxySse(`${TF.agent}/v1/research-run/${id}/events`, req.signal, last ? { "Last-Event-ID": last } : {});
}
