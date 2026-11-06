import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { signAuthorization, type AuthRequest } from "@/lib/wallet";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** Signs an x402 EIP-3009 payment from the user's platform wallet. Policy lives in checkAuthorization(). */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as AuthRequest | null;
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const out = await signAuthorization(user.id, body, process.env.PAY_TO_ADDRESS || "");
  return NextResponse.json(out, { status: "error" in out ? 400 : 200 });
}
