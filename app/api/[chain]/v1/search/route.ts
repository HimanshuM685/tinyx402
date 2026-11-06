import { NextRequest, NextResponse } from "next/server";
import { paidRoute, badRequest } from "@/lib/x402";
import { SearchQuery, issues } from "@/lib/schemas";
import { TF, tfJson, upstreamFailure } from "@/lib/tinyfish";

export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = paidRoute("search", "Structured web search results", async (req: NextRequest) => {
  const p = SearchQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!p.success) return badRequest("Invalid query", issues(p.error));
  const qs = new URLSearchParams(Object.entries(p.data).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
  try {
    return NextResponse.json(await tfJson(`${TF.search}/?${qs}`, { timeoutMs: 45_000 }));
  } catch (e) {
    return upstreamFailure(e);
  }
});
