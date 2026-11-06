import { NextResponse } from "next/server";
import { ADVERTISED } from "@/lib/chain-guard"; // not lib/x402: a 410 needs no facilitator clients
import { apiPath } from "@/lib/chains";

export const runtime = "nodejs";

/**
 * Migration stub. `/api/v1/*` used to serve every chain from one URL, which meant a caller could
 * not tell which asset it would be asked to pay in. Endpoints are per chain now.
 *
 * Not a redirect: there is no default chain, and silently picking one would charge someone in an
 * asset they did not choose. 410 rather than 404, so a client can tell "moved" from "typo".
 */
async function gone(_: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const suffix = `/v1/${(await ctx.params).path.join("/")}`;
  return NextResponse.json(
    {
      error: "endpoint_moved",
      message: "Endpoints are per chain now. Pick the chain you want to pay on; each quotes only its own asset.",
      paths: ADVERTISED.map((n) => apiPath(n, suffix)),
    },
    { status: 410 },
  );
}

export const GET = gone;
export const POST = gone;
export const DELETE = gone;
