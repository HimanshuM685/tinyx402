import { NextRequest, NextResponse } from "next/server";

// ponytail: in-memory per-instance window; swap for Upstash/Redis if multi-region abuse matters.
const hits = new Map<string, { n: number; reset: number }>();
const LIMIT = Number(process.env.RATE_LIMIT_PER_MIN || 60);

export function rateLimit(req: NextRequest): NextResponse | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + 60_000 });
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return null;
  }
  if (++h.n <= LIMIT) return null;
  return NextResponse.json(
    { error: "rate_limited", message: `Max ${LIMIT} requests/min per IP` },
    { status: 429, headers: { "Retry-After": String(Math.ceil((h.reset - now) / 1000)) } },
  );
}
