import { ENDPOINTS, PRICES } from "@/lib/pricing";
import { CHAINS, NETWORKS, apiPath } from "@/lib/chains";
import { facilitatorUrlFor } from "@/lib/chain-guard";

export const dynamic = "force-static";

export function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const body = `# tinyx402

> TinyFish web APIs (Search, Fetch, Agent, Research, Datasets, Browser) resold per request over x402. No API keys.

## Payment
- Protocol: x402 v2, scheme "exact" (EIP-3009 transferWithAuthorization, gasless for payer)
- Every 402 lists one \`accepts\` entry per chain below. Pay with whichever asset you hold; prices are identical in base units.
${NETWORKS.map((n) => {
  const c = CHAINS[n];
  return `- ${n} (${c.label}): asset ${c.asset.address} (${c.asset.symbol}, ${c.asset.decimals} decimals, EIP-712 domain name "${c.asset.extra.name}", version "${c.asset.extra.version}"), facilitator ${facilitatorUrlFor(n)}`;
}).join("\n")}
- Client: @x402/fetch wrapFetchWithPaymentFromConfig + @x402/evm ExactEvmScheme. Register the scheme for the chain you intend to pay on, and always set spendControls.allowedAssets.
- Failed requests (4xx/5xx) are never settled.

## Endpoints
Pick ONE chain prefix; the suffix and price are the same on all of them.
${NETWORKS.map((n) => `- ${CHAINS[n].label}: ${base}/api/${CHAINS[n].slug}/v1/<endpoint>`).join("\n")}

${ENDPOINTS.map((e) => `- ${e.method} ${e.path}: ${e.description}. ${PRICES[e.product]} base units${e.priceNote ? ` (${e.priceNote})` : ""}.`).join("\n")}

Example: ${ENDPOINTS[0].method} ${base}${apiPath(NETWORKS[0], ENDPOINTS[0].path)}?query=…

## Free follow-ups (for resources you paid to create)
Use the same chain prefix as the paid call (returned to you as poll_url / rows_url / events_url).
- GET /api/<chain>/v1/research/{id} and /api/<chain>/v1/research/{id}/events (SSE)
- GET /api/<chain>/v1/datasets/{id}, /rows?after=, /events?run= (SSE)
- DELETE /api/<chain>/v1/browser/{id}

## Docs
- ${base}/docs/for-coding-agents
- ${base}/docs/direct-api
- ${base}/api/openapi
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
