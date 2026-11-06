import { NextResponse } from "next/server";
import { TF, tf, safeId, upstreamFailure, UpstreamError } from "@/lib/tinyfish";
import { requireChain } from "@/lib/chain-guard";

export const runtime = "nodejs";

// Free: end a session early (only the payer knows its id). Idempotent.
// Free follow-up. Chain-agnostic: it only proxies by id, so the same resource reads the same
// under any chain prefix. The prefix exists so the URL matches the paid call that created it.
export async function DELETE(_: Request, ctx: { params: Promise<{ chain: string; id: string }> }) {
  const bad = await requireChain(ctx);
  if (bad) return bad; // real chain slug, or every resource gains unlimited URL aliases
  const { id } = await ctx.params;
  if (!safeId(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  try {
    const res = await tf(`${TF.browser}/${id}`, { method: "DELETE", timeoutMs: 20_000 });
    if (!res.ok && res.status !== 404) throw new UpstreamError(res.status, await res.json().catch(() => null));
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return upstreamFailure(e);
  }
}
