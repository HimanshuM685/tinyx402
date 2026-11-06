import { NextResponse } from "next/server";
import { TF, tf, safeId, upstreamFailure, UpstreamError } from "@/lib/tinyfish";

export const runtime = "nodejs";

// Free: end a session early (only the payer knows its id). Idempotent.
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!safeId(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  try {
    const res = await tf(`${TF.browser}/${id}`, { method: "DELETE", timeoutMs: 20_000 });
    if (!res.ok && res.status !== 404) throw new UpstreamError(res.status, await res.json().catch(() => null));
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return upstreamFailure(e);
  }
}
