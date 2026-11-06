import { NextRequest, NextResponse } from "next/server";
import { paidRoute, badRequest } from "@/lib/x402";
import { AgentBody, issues } from "@/lib/schemas";
import { TF, tfJson, upstreamFailure } from "@/lib/tinyfish";
import { agentPayload } from "@/lib/agent";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel Hobby max

type RunResult = { run_id: string | null; status: "COMPLETED" | "FAILED"; result: unknown; error: unknown };

export const POST = paidRoute("agent", "Goal-based browser automation", async (req: NextRequest) => {
  const p = AgentBody.safeParse(await req.json().catch(() => null));
  if (!p.success) return badRequest("Invalid body", issues(p.error));
  try {
    const out = await tfJson<RunResult>(`${TF.agent}/v1/automation/run`, {
      method: "POST",
      body: JSON.stringify(agentPayload(p.data)),
      timeoutMs: 295_000,
    });
    // A FAILED run is not charged.
    if (out.status !== "COMPLETED") return NextResponse.json({ ...out, charged: false }, { status: 502 });
    return NextResponse.json(out);
  } catch (e) {
    return upstreamFailure(e);
  }
});
