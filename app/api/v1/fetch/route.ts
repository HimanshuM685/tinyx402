import { NextRequest, NextResponse } from "next/server";
import { paidRoute, badRequest } from "@/lib/x402";
import { FetchBody, issues } from "@/lib/schemas";
import { TF, tfJson, upstreamFailure } from "@/lib/tinyfish";

export const runtime = "nodejs";
export const maxDuration = 300;

type FetchResult = { results: unknown[]; errors: unknown[] };

export const POST = paidRoute("fetch", "Clean content extraction from up to 10 URLs", async (req: NextRequest) => {
  const p = FetchBody.safeParse(await req.json().catch(() => null));
  if (!p.success) return badRequest("Invalid body", issues(p.error));
  try {
    const out = await tfJson<FetchResult>(TF.fetch, { method: "POST", body: JSON.stringify(p.data), timeoutMs: 280_000 });
    // Per-URL failures come back in errors[]; charge only if at least one URL succeeded.
    if (!out.results?.length) return NextResponse.json({ ...out, error: "all_failed", charged: false }, { status: 502 });
    return NextResponse.json(out);
  } catch (e) {
    return upstreamFailure(e);
  }
});
