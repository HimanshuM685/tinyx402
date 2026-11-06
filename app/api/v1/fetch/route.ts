import { NextRequest, NextResponse } from "next/server";
import { paidRoute, badRequest, failure } from "@/lib/x402";
import { FetchBody, issues } from "@/lib/schemas";
import { fetchRendered, fetchStatic } from "@/lib/extract";

export const runtime = "nodejs";
export const maxDuration = 120;

export const POST = paidRoute("fetch", "Clean content extraction from URL(s)", async (req: NextRequest) => {
  const p = FetchBody.safeParse(await req.json().catch(() => null));
  if (!p.success) return badRequest("Invalid body", issues(p.error));
  const { urls, format, render, links } = p.data;
  try {
    const t = Date.now();
    const settled = await Promise.allSettled(
      urls.map((u) => (render ? fetchRendered(u, format, links) : fetchStatic(u, format, links))),
    );
    const results = settled.map((s, i) =>
      s.status === "fulfilled" ? { ok: true, ...s.value } : { ok: false, url: urls[i], error: (s.reason as Error).message },
    );
    // Charge only if at least one URL succeeded.
    if (!results.some((r) => r.ok)) return NextResponse.json({ error: "all_failed", results, charged: false }, { status: 502 });
    return NextResponse.json({ results, took_ms: Date.now() - t });
  } catch (e) {
    return failure(e);
  }
});
