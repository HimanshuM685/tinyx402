import { NextRequest, NextResponse } from "next/server";
import { paidRoute, badRequest } from "@/lib/x402";
import { ResearchBody, issues } from "@/lib/schemas";
import { TF, tfJson, upstreamFailure } from "@/lib/tinyfish";
import { apiPath } from "@/lib/chains";

export const runtime = "nodejs";
export const maxDuration = 60;

// Research takes 5-45 minutes, longer than any request can stay open, so it starts async.
// The run is charged once it is accepted; follow it for free at the returned URLs.
export const POST = paidRoute("research", "Cited multi-source research report", async (req: NextRequest, chain) => {
  const p = ResearchBody.safeParse(await req.json().catch(() => null));
  if (!p.success) return badRequest("Invalid body", issues(p.error));
  try {
    const out = await tfJson<{ research_run_id: string; error: unknown }>(`${TF.agent}/v1/automation/run-research-async`, {
      method: "POST",
      body: JSON.stringify(p.data),
      timeoutMs: 50_000,
    });
    if (!out.research_run_id) return NextResponse.json({ ...out, error: "not_started", charged: false }, { status: 502 });
    const id = out.research_run_id;
    return NextResponse.json({
      research_run_id: id,
      status: "QUEUED",
      mode: p.data.mode,
      // Must carry the chain, or the follow-up 404s: every path is chain-scoped now.
      poll_url: apiPath(chain.network, `/v1/research/${id}`),
      events_url: apiPath(chain.network, `/v1/research/${id}/events`),
    });
  } catch (e) {
    return upstreamFailure(e);
  }
});
