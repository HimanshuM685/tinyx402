import "server-only";
/**
 * x402 v2 payment middleware for every /api/v1 route. Nothing here moves money directly:
 *   1. unpaid request      -> withX402 replies 402 + PAYMENT-REQUIRED (built by paid())
 *   2. client signs EIP-3009 TransferWithAuthorization off-chain, retries with PAYMENT-SIGNATURE
 *   3. facilitator /verify -> HTTPFacilitatorClient below (FACILITATOR_URL)
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
import { NETWORK, USDT, FACILITATOR_URL } from "./chains";
import { PRICES, quote, type Product } from "./pricing";
import { rateLimit } from "./ratelimit";
import { recordRun } from "./db";
import { sseResponse, type Emit } from "./sse";
import { issues } from "./schemas";
import { upstreamFailure, UpstreamError } from "./tinyfish";
import type { z } from "zod";

const network = (process.env.X402_NETWORK || NETWORK) as `${string}:${string}`;
const payTo = process.env.PAY_TO_ADDRESS || "";
const asset = process.env.USDT_ADDRESS || USDT.address;

export const facilitator = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL || FACILITATOR_URL,
});

export const server = new x402ResourceServer(facilitator).register(network, new ExactEvmScheme());

const DYNAMIC: Product[] = ["research", "datasets"];

/** Route config for a product, using the explicit asset/amount/extra price shape. */
export function paid(product: Product, description: string): RouteConfig {
  if (!/^0x[0-9a-fA-F]{40}$/.test(payTo)) throw new Error("PAY_TO_ADDRESS is not set to a valid EVM address");
  return {
    accepts: {
      scheme: "exact",
      network,
      payTo,
      price: DYNAMIC.includes(product)
        ? // research mode / dataset row count change the price; quoted from the request body
          async (ctx) => ({
            asset,
            amount: quote(product, await ctx.adapter.getBody?.()),
            extra: { name: "Tether USD", version: "1" },
          })
        : {
            asset, // Whitechain Sepolia USDT
            amount: PRICES[product],
            extra: { name: "Tether USD", version: "1" },
          },
      maxTimeoutSeconds: 300,
    },
    description,
    mimeType: "application/json",
    serviceName: "tinyx402",
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
        network: settle?.network ?? network,
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
    http ??= new x402HTTPResourceServer(server, paid(product, description));
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
