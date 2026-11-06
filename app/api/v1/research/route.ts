import { NextRequest, NextResponse } from "next/server";
import { paidRoute, paidStream, badRequest, failure } from "@/lib/x402";
import { ResearchBody, issues } from "@/lib/schemas";
import { runResearch } from "@/lib/research";

export const runtime = "nodejs";
export const maxDuration = 300;

const json = paidRoute("research", "Multi-source research report", async (req: NextRequest) => {
  const p = ResearchBody.safeParse(await req.json().catch(() => null));
  if (!p.success) return badRequest("Invalid body", issues(p.error));
  try {
    const t = Date.now();
    return NextResponse.json({ ...(await runResearch(p.data, undefined, req.signal)), took_ms: Date.now() - t });
  } catch (e) {
    return failure(e);
  }
});

const stream = paidStream(
  "research",
  "Multi-source research report (SSE)",
  ResearchBody,
  (input, emit, signal) => runResearch(input, emit, signal),
);

// POST /api/v1/research?stream=1 (or Accept: text/event-stream) streams progress events.
export const POST = (req: NextRequest) =>
  req.nextUrl.searchParams.get("stream") === "1" || req.headers.get("accept")?.includes("text/event-stream")
    ? stream(req)
    : json(req);
