import "server-only";
import { NextResponse } from "next/server";
import { CHAINS, NETWORKS, apiPath, isNetwork, networkOfSlug, type Network } from "./chains";

/**
 * Which chains this deployment sells on, and how a URL's chain segment becomes one.
 *
 * Kept out of lib/x402.ts so the free follow-up routes can validate their chain segment without
 * pulling in the facilitator clients and resource server they never use.
 */

/**
 * Defaults to every configured chain; X402_NETWORKS narrows it to a comma-separated subset.
 *
 * X402_NETWORK (singular) is the pre-multi-chain name and is deliberately IGNORED. It names a
 * single network in every old .env, so honouring it meant a deployment that added a chain never
 * advertised it and got no hint why — which is exactly how production ended up quoting USDT for
 * an Arc request. Ignored and called out rather than honoured or fatal.
 */
export const ADVERTISED: Network[] = (() => {
  if (process.env.X402_NETWORK) {
    console.warn(
      "[x402] X402_NETWORK is ignored (it predates multi-chain and pinned deployments to one " +
        "chain). Delete it; use X402_NETWORKS to advertise fewer chains on purpose.",
    );
  }
  const want = (process.env.X402_NETWORKS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!want.length) return NETWORKS;
  const bad = want.filter((n) => !isNetwork(n));
  if (bad.length) throw new Error(`X402_NETWORKS has unknown network(s): ${bad.join(", ")}. Known: ${NETWORKS.join(", ")}`);
  const missing = NETWORKS.filter((n) => !want.includes(n));
  if (missing.length) {
    console.warn(`[x402] Only advertising ${want.join(", ")} — ${missing.join(", ")} excluded by X402_NETWORKS.`);
  }
  return want as Network[];
})();

/**
 * The facilitator this deployment actually talks to for a chain, overridable for self-hosting:
 * <SLUG>_FACILITATOR_URL, e.g. ARC_FACILITATOR_URL. Server-side only, so the dynamic lookup is
 * fine (NEXT_PUBLIC_* would have to be literal). FACILITATOR_URL without a prefix predates
 * multi-chain and still applies to Whitechain.
 *
 * Everything that publishes a facilitator URL (openapi, llms.txt, the landing page) must read it
 * from here, or a self-hosted deployment advertises one facilitator and calls another.
 */
export const facilitatorUrlFor = (n: Network) =>
  process.env[`${CHAINS[n].slug.toUpperCase()}_FACILITATOR_URL`] ||
  (n === "eip155:1874" ? process.env.FACILITATOR_URL : undefined) ||
  CHAINS[n].facilitatorUrl;

/** The chain a request resolved to, handed to every paid handler so it can build its own URLs. */
export type ChainCtx = { network: Network; slug: string };
export type RouteCtx = { params: Promise<Record<string, string>> };

const notFound = (chain: string) =>
  NextResponse.json(
    { error: "unknown_chain", message: `No such chain: ${chain}`, paths: ADVERTISED.map((n) => apiPath(n, "/v1/…")) },
    { status: 404 },
  );

/**
 * Paid routes: the URL's chain slug, or the 404 to send. The old `/api/v1/*` paths are a segment
 * shorter so they never reach here — `app/api/v1/[...path]` answers those.
 */
export async function resolveChain(ctx: RouteCtx): Promise<ChainCtx | NextResponse> {
  const { chain } = await ctx.params;
  const network = networkOfSlug(chain);
  if (network && ADVERTISED.includes(network)) return { network, slug: chain };
  return notFound(chain);
}

/**
 * Free follow-up routes: returns the 404 to send, or null to continue. They proxy by id and
 * genuinely do not care which chain, but the slug still has to be a real one — otherwise every
 * resource gains unlimited URL aliases and the run log's `endpoint` column stops meaning anything.
 */
export async function requireChain(ctx: RouteCtx): Promise<NextResponse | null> {
  const { chain } = await ctx.params;
  return networkOfSlug(chain) ? null : notFound(chain);
}

export { CHAINS };
