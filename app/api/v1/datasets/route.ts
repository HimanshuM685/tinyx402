import { NextRequest, NextResponse } from "next/server";
import { paidRoute, badRequest } from "@/lib/x402";
import { DatasetBody, issues } from "@/lib/schemas";
import { TF, tfJson, upstreamFailure } from "@/lib/tinyfish";

export const runtime = "nodejs";
export const maxDuration = 120;

type Dataset = { id: string; run?: { id: string } } & Record<string, unknown>;

// Priced per target row. Planning takes up to a minute; filling continues in the background.
export const POST = paidRoute("datasets", "Structured dataset filled from the web", async (req: NextRequest) => {
  const p = DatasetBody.safeParse(await req.json().catch(() => null));
  if (!p.success) return badRequest("Invalid body", issues(p.error));
  try {
    const ds = await tfJson<Dataset>(`${TF.agent}/v1/datasets`, {
      method: "POST",
      body: JSON.stringify({ ...p.data, populate: true }),
      timeoutMs: 110_000,
    });
    return NextResponse.json({
      ...ds,
      poll_url: `/api/v1/datasets/${ds.id}`,
      rows_url: `/api/v1/datasets/${ds.id}/rows`,
      events_url: ds.run?.id ? `/api/v1/datasets/${ds.id}/events?run=${ds.run.id}` : null,
    });
  } catch (e) {
    return upstreamFailure(e);
  }
});
