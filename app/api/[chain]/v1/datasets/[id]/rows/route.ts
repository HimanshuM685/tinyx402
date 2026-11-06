import { NextRequest, NextResponse } from "next/server";
import { TF, proxyGet, safeId } from "@/lib/tinyfish";
import { requireChain } from "@/lib/chain-guard";

export const runtime = "nodejs";

// Free: one page of rows. Pass next_cursor back as ?after=.
// Free follow-up. Chain-agnostic: it only proxies by id, so the same resource reads the same
// under any chain prefix. The prefix exists so the URL matches the paid call that created it.
export async function GET(req: NextRequest, ctx: { params: Promise<{ chain: string; id: string }> }) {
  const bad = await requireChain(ctx);
  if (bad) return bad; // real chain slug, or every resource gains unlimited URL aliases
  const { id } = await ctx.params;
  if (!safeId(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const qs = new URLSearchParams();
  for (const k of ["after", "limit"]) {
    const v = req.nextUrl.searchParams.get(k);
    if (v && /^[\w=-]{1,500}$/.test(v)) qs.set(k, v);
  }
  return proxyGet(`${TF.agent}/v1/datasets/${id}/rows${qs.size ? `?${qs}` : ""}`);
}
