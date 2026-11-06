import { NextRequest, NextResponse } from "next/server";
import { TF, proxyGet, safeId } from "@/lib/tinyfish";

export const runtime = "nodejs";

// Free: one page of rows. Pass next_cursor back as ?after=.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!safeId(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const qs = new URLSearchParams();
  for (const k of ["after", "limit"]) {
    const v = req.nextUrl.searchParams.get(k);
    if (v && /^[\w=-]{1,500}$/.test(v)) qs.set(k, v);
  }
  return proxyGet(`${TF.agent}/v1/datasets/${id}/rows${qs.size ? `?${qs}` : ""}`);
}
