import { NextResponse } from "next/server";
import { TF, proxySse, safeId } from "@/lib/tinyfish";

export const runtime = "nodejs";
export const maxDuration = 800;

// Free: live progress events. Reconnect with Last-Event-ID; disconnecting does not cancel the run.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!safeId(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const last = req.headers.get("last-event-id");
  return proxySse(`${TF.agent}/v1/research-run/${id}/events`, req.signal, last ? { "Last-Event-ID": last } : {});
}
