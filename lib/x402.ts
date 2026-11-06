import "server-only";
/**
 * x402 v2 payment middleware for every /api/v1 route. Nothing here moves money directly:
 *   1. unpaid request      -> withX402 replies 402 + PAYMENT-REQUIRED (built by paid())
 *   2. client signs EIP-3009 TransferWithAuthorization off-chain, retries with PAYMENT-SIGNATURE
 *   3. facilitator /verify -> the HTTPFacilitatorClient for that payment's chain (see below)
 *   4. handler runs        -> TinyFish call
 *   5. facilitator /settle -> only when the handler returned status < 400; facilitator pays gas
 *   6. receipt             -> PAYMENT-RESPONSE header (or final `payment` SSE event in paidStream)
 * Per-route withX402 rather than a proxy.ts paymentProxy: paymentProxy settles failed responses
 * too, and can't price from the request body (research/datasets) or stream (agent SSE).
 */
import { NextRequest, NextResponse } from "next/server";
import { withX402, NextAdapter, x402ResourceServer } from "@x402/next";
import { HTTPFacilitatorClient, x402HTTPResourceServer, type RouteConfig } from "@x402/core/server";
import { decodePaymentResponseHeader } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { z } from "zod";
import { CHAINS, NETWORKS, isNetwork, type Network } from "./chains";
import { PRICES, quote, type Product } from "./pricing";
import { rateLimit } from "./ratelimit";
import { recordRun } from "./db";
import { sseResponse, type Emit } from "./sse";
import { issues, SearchQuery, FetchBody, AgentBody, ResearchBody, DatasetBody, BrowserBody } from "./schemas";
import { DEFAULTS, buildRequest, type Id } from "./playground";
import { upstreamFailure, UpstreamError } from "./tinyfish";

const payTo = process.env.PAY_TO_ADDRESS || "";

/**
 * Networks advertised in every 402. Defaults to every configured chain.
 *
 * X402_NETWORKS narrows it to a comma-separated subset, for a deployment that wants to sell on
 * one chain. X402_NETWORK (singular) is the pre-multi-chain name and still works — but it is
 * set to a single network in every old .env, so honouring it silently would mean a deployment
 * that added Arc never offers it and gets no hint why. Hence the warning.
 */
export const ADVERTISED: Network[] = (() => {
  const raw = process.env.X402_NETWORKS || process.env.X402_NETWORK || "";
  const want = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!want.length) return NETWORKS;
  const bad = want.filter((n) => !isNetwork(n));
  if (bad.length) {
    throw new Error(
      `${process.env.X402_NETWORKS ? "X402_NETWORKS" : "X402_NETWORK"} has unknown network(s): ${bad.join(", ")}. Known: ${NETWORKS.join(", ")}`,
    );
  }
  const missing = NETWORKS.filter((n) => !want.includes(n));
  if (missing.length) {
    console.warn(
      `[x402] Only advertising ${want.join(", ")} — ${missing.join(", ")} excluded by ` +
        `${process.env.X402_NETWORKS ? "X402_NETWORKS" : "X402_NETWORK"}. Unset it to sell on every chain.`,
    );
  }
  return want as Network[];
})();

/** The facilitator URL for a network, overridable per chain for self-hosting. */
const facilitatorUrl = (n: Network) =>
  (n === "eip155:1874" ? process.env.FACILITATOR_URL : process.env.ARC_FACILITATOR_URL) || CHAINS[n].facilitatorUrl;

// One client per distinct URL. The resource server fetches /supported from each and routes
// verify/settle by the network in the payment payload, so no dispatch logic belongs here.
// This has to be exact: initialize() throws RouteConfigurationError if a network in `accepts`
// is not served by any registered facilitator, which would break every paid route, not just one.
export const facilitators = [...new Set(ADVERTISED.map(facilitatorUrl))].map(
  (url) => new HTTPFacilitatorClient({ url }),
);

export const server = ADVERTISED.reduce(
  (s, n) => s.register(n, new ExactEvmScheme()),
  new x402ResourceServer(facilitators),
).registerExtension(bazaarResourceServerExtension); // Bazaar discovery: method + route enrichment

const SCHEMAS: Record<Id, z.ZodType> = {
  search: SearchQuery, fetch: FetchBody, agent: AgentBody, "agent-sse": AgentBody, research: ResearchBody, datasets: DatasetBody, browser: BrowserBody,
};
const OUTPUTS: Record<Id, unknown> = {
  search: { results: [{ title: "x402", url: "https://www.x402.org", snippet: "…" }] },
  fetch: { results: [{ url: "https://www.tinyfish.ai/", text: "# TinyFish …" }] },
  agent: { run_id: "run_…", status: "COMPLETED", result: { stories: [{ title: "…", url: "…" }] } },
  "agent-sse": { events: ["started", "progress", "complete {result}", "payment {transaction}", "done"] },
  research: { id: "res_…", status: "running", events: "/api/v1/research/res_…/events (free)" },
  datasets: { id: "ds_…", status: "running", rows: "/api/v1/datasets/ds_…/rows (free)" },
  browser: { session_id: "…", cdp_url: "wss://…", base_url: "https://…" },
};
const TAGS: Record<Id, string[]> = {
  search: ["search", "web"], fetch: ["scrape", "web"], agent: ["agent", "browser"], "agent-sse": ["agent", "browser", "sse"],
  research: ["research", "web"], datasets: ["data", "web"], browser: ["browser", "cdp"],
};

/** Bazaar docs for an endpoint: input example from the playground defaults, schema from zod. */
export function discovery(id: Id) {
  const built = buildRequest(id, DEFAULTS[id]);
  if ("error" in built) throw new Error(`playground defaults for ${id}: ${built.error}`);
  const inputSchema = z.toJSONSchema(SCHEMAS[id], { io: "input" }) as Record<string, unknown>;
  delete inputSchema.$schema;
  const output = { example: OUTPUTS[id] };
  return id === "search"
    ? declareDiscoveryExtension({ input: Object.fromEntries(new URL(built.url, "http://x").searchParams), inputSchema, output })
    : declareDiscoveryExtension({ bodyType: "json", input: built.body, inputSchema, output });
}

const DYNAMIC: Product[] = ["research", "datasets"];

/** @x402/core exports RouteConfig but not the option type inside it. */
type PaymentOption = Extract<RouteConfig["accepts"], unknown[]>[number];

/** Route config for a product, using the explicit asset/amount/extra price shape. */
export function paid(product: Product, description: string, stream = false): RouteConfig {
  const id: Id = stream ? "agent-sse" : product;
  if (!/^0x[0-9a-fA-F]{40}$/.test(payTo)) throw new Error("PAY_TO_ADDRESS is not set to a valid EVM address");
  // One option per advertised chain. The payer signs with whatever they hold; `extra` must come
  // from the registry per chain (Whitechain USDT is version "1", Arc USDC is version "2" — a
  // shared literal here is the classic way to make one chain's signatures silently unverifiable).
  return {
    accepts: ADVERTISED.map((n): PaymentOption => ({
      scheme: "exact",
      network: n,
      payTo,
      price: DYNAMIC.includes(product)
        ? // research mode / dataset row count change the price; quoted from the request body
          async (ctx) => ({
            asset: CHAINS[n].asset.address,
            amount: quote(product, await ctx.adapter.getBody?.()),
            extra: CHAINS[n].asset.extra,
          })
        : {
            asset: CHAINS[n].asset.address,
            amount: PRICES[product],
            extra: CHAINS[n].asset.extra,
          },
      maxTimeoutSeconds: 300,
    })),
    description,
    mimeType: stream ? "text/event-stream" : "application/json",
    serviceName: "tinyx402",
    tags: TAGS[id],
    extensions: discovery(id),
  };
}

type Handler = (req: NextRequest) => Promise<NextResponse>;

async function readInput(req: NextRequest) {
  if (req.method === "GET") return Object.fromEntries(req.nextUrl.searchParams);
  return req.clone().json().catch(() => null);
}

/** withX402 (settles only on status < 400) + rate limit + run log. */
export function paidRoute(product: Product, description: string, handler: Handler): Handler {
  let wrapped: Handler | null = null;
  return async (req) => {
    const limited = rateLimit(req);
    if (limited) return limited;
    wrapped ??= withX402(handler, paid(product, description), server);
    const started = Date.now();
    const input = await readInput(req);
    const res = await wrapped(req);
    const header = res.headers.get("payment-response");
    if (header) {
      const settle = safeDecode(header);
      const output = await res.clone().json().catch(() => null);
      recordRun({
        endpoint: req.nextUrl.pathname,
        amount: quote(product, input),
        payer: settle?.payer,
        txHash: settle?.transaction,
        // quote() is right only because every chain is priced identically in base units
        // (both assets are 6 decimals; selftest asserts it). The asset is derivable from network.
        network: settle?.network ?? "unknown",
        status: res.status,
        input,
        output,
        durationMs: Date.now() - started,
      });
    }
    return res;
  };
}

function safeDecode(h: string) {
  try {
    return decodePaymentResponseHeader(h);
  } catch {
    return null;
  }
}

/**
 * Streaming variant. withX402 buffers the body before settling, which defeats SSE,
 * so: verify payment, open the upstream stream (upstream 4xx/5xx -> JSON error, not charged),
 * relay events, settle only if relay() says the run succeeded. The receipt is sent as a
 * final `payment` event because headers are already gone.
 */
export function paidStream<T>(
  product: Product,
  description: string,
  schema: z.ZodType<T>,
  open: (input: T, signal: AbortSignal) => Promise<Response>,
  relay: (upstream: Response, emit: Emit) => Promise<unknown>, // throws if the run failed
): Handler {
  let http: x402HTTPResourceServer | null = null;
  let ready: Promise<void> | null = null;
  return async (req) => {
    const limited = rateLimit(req);
    if (limited) return limited;
    http ??= new x402HTTPResourceServer(server, paid(product, description, true));
    ready ??= http.initialize().catch((e) => {
      ready = null;
      throw e;
    });
    await ready;

    const adapter = new NextAdapter(req);
    const ctx = {
      adapter,
      path: req.nextUrl.pathname,
      method: req.method,
      paymentHeader: adapter.getHeader("payment-signature") || adapter.getHeader("x-payment"),
    };
    const result = await http.processHTTPRequest(ctx);
    if (result.type === "payment-error") {
      const r = result.response;
      return NextResponse.json(r.body ?? {}, { status: r.status, headers: r.headers });
    }
    if (result.type !== "payment-verified") {
      return NextResponse.json({ error: "payment_required" }, { status: 402 });
    }
    const cancel = (status: number) => result.cancellationDispatcher.cancel({ reason: "handler_failed", responseStatus: status });

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      await cancel(400);
      return badRequest("Invalid body", issues(parsed.error));
    }
    const input = parsed.data;

    const abort = new AbortController();
    let upstream: Response;
    try {
      upstream = await open(input, abort.signal);
      if (!upstream.ok || !upstream.body) {
        throw new UpstreamError(upstream.status, await upstream.json().catch(() => null));
      }
    } catch (e) {
      const res = upstreamFailure(e);
      await cancel(res.status);
      return res;
    }

    const started = Date.now();
    return sseResponse(async (emit, signal) => {
      signal.addEventListener("abort", () => abort.abort());
      let output: unknown;
      try {
        output = await relay(upstream, emit);
      } catch (error) {
        await result.cancellationDispatcher.cancel({ reason: "handler_threw", error });
        emit("error", { error: "run_failed", message: (error as Error).message, charged: false });
        return;
      }
      const settle = await http!.processSettlement(
        result.paymentPayload,
        result.paymentRequirements,
        result.declaredExtensions,
        { request: ctx },
      );
      const paymentResponse = settle.success ? settle.headers["PAYMENT-RESPONSE"] ?? settle.headers["payment-response"] : undefined;
      emit("payment", {
        success: settle.success,
        transaction: settle.transaction,
        payer: settle.payer,
        network: settle.network,
        errorReason: settle.errorReason,
        paymentResponse,
      });
      if (settle.success) {
        recordRun({
          endpoint: req.nextUrl.pathname,
          amount: result.paymentRequirements.amount,
          payer: settle.payer,
          txHash: settle.transaction,
          network: settle.network,
          status: 200,
          input,
          output,
          durationMs: Date.now() - started,
        });
      }
      emit("done", { ok: settle.success });
    });
  };
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: "invalid_request", message, details }, { status: 400 });
}
