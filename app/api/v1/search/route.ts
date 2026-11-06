import { NextRequest, NextResponse } from "next/server";
import { paidRoute, badRequest, failure } from "@/lib/x402";
import { SearchQuery, issues } from "@/lib/schemas";
import { search } from "@/lib/search";

export const runtime = "nodejs";
export const maxDuration = 30;

export const GET = paidRoute("search", "Structured web search results", async (req: NextRequest) => {
  const p = SearchQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!p.success) return badRequest("Invalid query", issues(p.error));
  try {
    const t = Date.now();
    const { provider, results } = await search(p.data.q, p.data.limit);
    return NextResponse.json({ query: p.data.q, provider, results, took_ms: Date.now() - t });
  } catch (e) {
    return failure(e);
  }
});
