import { NextResponse } from "next/server";
import { z } from "zod";
import { ENDPOINTS, PRICES } from "@/lib/pricing";
import { NETWORK, USDT, FACILITATOR_URL } from "@/lib/chains";
import { SearchQuery, FetchBody, AgentBody, ResearchBody, BrowserBody } from "@/lib/schemas";

export const dynamic = "force-static";

const BODIES: Record<string, z.ZodType> = {
  fetch: FetchBody, agent: AgentBody, "agent-sse": AgentBody, research: ResearchBody, browser: BrowserBody,
};

export function GET() {
  const paths: Record<string, unknown> = {};
  for (const e of ENDPOINTS) {
    const op: Record<string, unknown> = {
      operationId: e.id.replace(/-(\w)/g, (_, c) => c.toUpperCase()),
      summary: e.title,
      description: `${e.description}. Price: ${PRICES[e.product]} base units of USDT (${Number(PRICES[e.product]) / 1e6} USDT), paid via x402.`,
      "x-x402": { scheme: "exact", network: NETWORK, asset: USDT.address, amount: PRICES[e.product], extra: USDT.extra, facilitator: FACILITATOR_URL },
      security: [{ x402: [] }],
      responses: {
        "200": { description: "Success. PAYMENT-RESPONSE header carries the settlement receipt.", content: { [e.stream ? "text/event-stream" : "application/json"]: {} } },
        "400": { description: "Invalid input (not charged)" },
        "402": { description: "Payment required. PAYMENT-REQUIRED header holds base64 JSON requirements." },
        "429": { description: "Rate limited" },
        "502": { description: "Upstream failure (not charged)" },
      },
    };
    if (e.method === "GET") {
      const js = z.toJSONSchema(SearchQuery, { io: "input" }) as { properties: Record<string, object>; required?: string[] };
      op.parameters = Object.entries(js.properties).map(([name, schema]) => ({ name, in: "query", required: js.required?.includes(name), schema }));
    } else {
      op.requestBody = { required: true, content: { "application/json": { schema: z.toJSONSchema(BODIES[e.id], { io: "input" }) } } };
    }
    paths[e.path] = { [e.method.toLowerCase()]: op };
  }
  return NextResponse.json({
    openapi: "3.1.0",
    info: { title: "tinyx402 API", version: "1.0.0", description: "Web agent APIs paid per request with x402 on Whitechain. No API keys." },
    servers: [{ url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000" }],
    components: {
      securitySchemes: {
        x402: { type: "apiKey", in: "header", name: "PAYMENT-SIGNATURE", description: "x402 v2 payment payload (base64). Obtain requirements from the 402 response." },
      },
    },
    paths,
  });
}
