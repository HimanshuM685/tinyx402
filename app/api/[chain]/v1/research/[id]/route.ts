import { NextResponse } from "next/server";
import { TF, proxyGet, safeId } from "@/lib/tinyfish";
import { requireChain } from "@/lib/chain-guard";

export const runtime = "nodejs";

// Free: read a research run started via the paid POST.
// Free follow-up. Chain-agnostic: it only proxies by id, so the same resource reads the same
// under any chain prefix. The prefix exists so the URL matches the paid call that created it.
export async function GET(_: Request, ctx: { params: Promise<{ chain: string; id: string }> }) {
  const bad = await requireChain(ctx);
  if (bad) return bad; // real chain slug, or every resource gains unlimited URL aliases
  const { id } = await ctx.params;
  if (!safeId(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  return proxyGet(`${TF.agent}/v1/research-run/${id}`);
}
