import { NextRequest, NextResponse } from "next/server";
import { paidRoute, badRequest, failure } from "@/lib/x402";
import { AgentBody, issues } from "@/lib/schemas";
import { runAgent } from "@/lib/agent";

export const runtime = "nodejs";
export const maxDuration = 300;

export const POST = paidRoute("agent", "Goal-based browser automation", async (req: NextRequest) => {
  const p = AgentBody.safeParse(await req.json().catch(() => null));
  if (!p.success) return badRequest("Invalid body", issues(p.error));
  try {
    const t = Date.now();
    const out = await runAgent(p.data, undefined, req.signal);
    return NextResponse.json({ ...out, took_ms: Date.now() - t });
  } catch (e) {
    return failure(e);
  }
});
