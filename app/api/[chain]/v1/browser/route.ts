import { NextRequest, NextResponse } from "next/server";
import { paidRoute, badRequest } from "@/lib/x402";
import { BrowserBody, issues } from "@/lib/schemas";
import { TF, tfJson, upstreamFailure } from "@/lib/tinyfish";
import { apiPath } from "@/lib/chains";

export const runtime = "nodejs";
export const maxDuration = 90;

type Session = { session_id: string; cdp_url: string; base_url: string };

export const POST = paidRoute("browser", "Remote browser session (CDP)", async (req: NextRequest, chain) => {
  const p = BrowserBody.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return badRequest("Invalid body", issues(p.error));
  try {
    // Session creation takes 10-30s.
    const s = await tfJson<Session>(TF.browser, { method: "POST", body: JSON.stringify(p.data), timeoutMs: 80_000 });
    return NextResponse.json({ ...s, end_url: apiPath(chain.network, `/v1/browser/${s.session_id}`) });
  } catch (e) {
    return upstreamFailure(e);
  }
});
