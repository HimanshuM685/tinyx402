import { NextResponse } from "next/server";
import { TF, proxyGet, safeId } from "@/lib/tinyfish";

export const runtime = "nodejs";

// Free: dataset status (populating | ready | empty | failed | cancelled).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!safeId(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  return proxyGet(`${TF.agent}/v1/datasets/${id}`);
}
