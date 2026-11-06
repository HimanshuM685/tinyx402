import { ENDPOINTS, PRICES } from "@/lib/pricing";
import { NETWORK, USDT, FACILITATOR_URL } from "@/lib/chains";

export const dynamic = "force-static";

export function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const body = `# tinyx402

> TinyFish web APIs (Search, Fetch, Agent, Research, Datasets, Browser) resold per request over x402 (USDT on Whitechain). No API keys.

## Payment
- Protocol: x402 v2, scheme "exact" (EIP-3009 transferWithAuthorization, gasless for payer)
- Network: ${NETWORK} (Whitechain Sepolia)
- Asset: ${USDT.address} (USDT, 6 decimals, EIP-712 domain name "Tether USD", version "1")
- Facilitator: ${FACILITATOR_URL}
- Client: @x402/fetch wrapFetchWithPaymentFromConfig + @x402/evm ExactEvmScheme. Always set spendControls.allowedAssets.
- Failed requests (4xx/5xx) are never settled.

## Endpoints
${ENDPOINTS.map((e) => `- ${e.method} ${base}${e.path}: ${e.description}. ${PRICES[e.product]} base units${e.priceNote ? ` (${e.priceNote})` : ""}.`).join("\n")}

## Free follow-ups (for resources you paid to create)
- GET ${base}/api/v1/research/{id} and /api/v1/research/{id}/events (SSE)
- GET ${base}/api/v1/datasets/{id}, /rows?after=, /events?run= (SSE)
- DELETE ${base}/api/v1/browser/{id}

## Docs
- ${base}/docs/for-coding-agents
- ${base}/docs/direct-api
- ${base}/api/openapi
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
