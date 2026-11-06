import { NextResponse } from "next/server";
import { z } from "zod";
import { ENDPOINTS, PRICES, RESEARCH_MAX_PRICE } from "@/lib/pricing";
import { CHAINS, NETWORKS } from "@/lib/chains";
import { SearchQuery, FetchBody, AgentBody, ResearchBody, BrowserBody, DatasetBody } from "@/lib/schemas";

export const dynamic = "force-static";

const BODIES: Record<string, z.ZodType> = {
  fetch: FetchBody, agent: AgentBody, "agent-sse": AgentBody, research: ResearchBody, browser: BrowserBody, datasets: DatasetBody,
};

export function GET() {
  const paths: Record<string, unknown> = {};
  for (const e of ENDPOINTS) {
    const op: Record<string, unknown> = {
      operationId: e.id.replace(/-(\w)/g, (_, c) => c.toUpperCase()),
      summary: e.title,
      description: `${e.description}. Price: ${PRICES[e.product]} base units${e.product === "datasets" ? " per target_rows" : ""}${e.product === "research" ? ` (${RESEARCH_MAX_PRICE} for mode "max")` : ""}, paid via x402. Backed by TinyFish.`,
      // One entry per chain, mirroring the `accepts` array in the live 402.
      "x-x402": NETWORKS.map((n) => ({
        scheme: "exact",
        network: n,
        asset: CHAINS[n].asset.address,
        amount: PRICES[e.product],
        extra: CHAINS[n].asset.extra,
        facilitator: CHAINS[n].facilitatorUrl,
      })),
      security: [{ x402: [] }],
      responses: {
        "200": { description: "Success. PAYMENT-RESPONSE header carries the settlement receipt.", content: { [e.stream ? "text/event-stream" : "application/json"]: {} } },
        "400": { description: "Invalid input (not charged)" },
        "402": { description: "Payment required. PAYMENT-REQUIRED header holds base64 JSON requirements." },
        "429": { description: "Rate limited" },
        "502": { description: "Upstream failure (not charged)" },
        "503": { description: "Upstream capacity unavailable (not charged)" },
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
  // Free follow-up endpoints for resources created by a paid call.
  const free = (summary: string, sse = false) => ({
    summary,
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
    responses: { "200": { description: "OK", content: { [sse ? "text/event-stream" : "application/json"]: {} } } },
  });
  paths["/api/v1/research/{id}"] = { get: free("Get research run (free)") };
  paths["/api/v1/research/{id}/events"] = { get: free("Follow research progress (free, SSE)", true) };
  paths["/api/v1/datasets/{id}"] = { get: free("Get dataset status (free)") };
  paths["/api/v1/datasets/{id}/rows"] = { get: free("Get dataset rows (free); ?after=cursor") };
  paths["/api/v1/datasets/{id}/events"] = { get: free("Follow dataset fill (free, SSE); ?run=runId", true) };
  paths["/api/v1/browser/{id}"] = { delete: { ...free("End browser session early (free)"), responses: { "204": { description: "Ended" } } } };
  return NextResponse.json({
    openapi: "3.1.0",
    info: { title: "tinyx402 API", version: "1.0.0", description: `Web agent APIs paid per request with x402 on ${NETWORKS.map((n) => CHAINS[n].label).join(" or ")}. No API keys.` },
    servers: [{ url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000" }],
    components: {
      securitySchemes: {
        x402: { type: "apiKey", in: "header", name: "PAYMENT-SIGNATURE", description: "x402 v2 payment payload (base64). Obtain requirements from the 402 response." },
      },
    },
    paths,
  });
}
