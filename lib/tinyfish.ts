import "server-only";
import { NextResponse } from "next/server";

export const TF = {
  search: "https://api.search.tinyfish.ai",
  fetch: "https://api.fetch.tinyfish.ai",
  browser: "https://api.browser.tinyfish.ai",
  agent: "https://agent.tinyfish.ai",
};

export class UpstreamError extends Error {
  constructor(public status: number, public body: unknown) {
    super(typeof body === "object" && body && "error" in body ? JSON.stringify((body as { error: unknown }).error) : `TinyFish HTTP ${status}`);
  }
}

/** Raw call to TinyFish with the operator key. Callers never see the key. */
export function tf(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const key = process.env.TINYFISH_API_KEY;
  if (!key) throw new UpstreamError(503, { error: "TINYFISH_API_KEY is not configured" });
  const { timeoutMs = 60_000, ...rest } = init;
  return fetch(url, {
    ...rest,
    headers: { "X-API-Key": key, ...(rest.body ? { "Content-Type": "application/json" } : {}), ...rest.headers },
    signal: rest.signal ?? AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
}

export async function tfJson<T = unknown>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const res = await tf(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new UpstreamError(res.status, body);
  return body as T;
}

/**
 * Map an upstream failure to our response. Every branch is >= 400, so withX402 never settles.
 * 400/404/422 = caller input → pass through. 401/402/403 = operator account problem → 503.
 */
export function upstreamFailure(e: unknown) {
  if (e instanceof UpstreamError) {
    const s = e.status;
    if (s === 400 || s === 404 || s === 409 || s === 422)
      return NextResponse.json({ error: "invalid_request", upstream: e.body, charged: false }, { status: s });
    if (s === 429) return NextResponse.json({ error: "rate_limited", charged: false }, { status: 429, headers: { "Retry-After": "10" } });
    if (s === 401 || s === 402 || s === 403 || s === 503)
      return NextResponse.json({ error: "service_unavailable", message: "Upstream capacity unavailable, try later", charged: false }, { status: 503 });
    return NextResponse.json({ error: "upstream_failed", upstream: e.body, charged: false }, { status: 502 });
  }
  const err = e as Error;
  console.error(err);
  const timeout = err?.name === "TimeoutError" || err?.name === "AbortError";
  return NextResponse.json(
    { error: timeout ? "upstream_timeout" : "upstream_failed", message: err?.message?.split("\n")[0], charged: false },
    { status: timeout ? 504 : 502 },
  );
}

export const safeId = (id: string) => /^[A-Za-z0-9_-]{1,100}$/.test(id);

/** Free read-through for resources created by a paid call (dataset/research run IDs are unguessable). */
export async function proxyGet(url: string) {
  try {
    return NextResponse.json(await tfJson(url, { timeoutMs: 30_000 }));
  } catch (e) {
    return upstreamFailure(e);
  }
}

/** Pipe an upstream SSE stream straight through. */
export async function proxySse(url: string, signal: AbortSignal, headers: Record<string, string> = {}) {
  try {
    const res = await tf(url, { signal, headers: { Accept: "text/event-stream", ...headers } });
    if (!res.ok || !res.body) throw new UpstreamError(res.status, await res.json().catch(() => null));
    return new Response(res.body, {
      headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
    });
  } catch (e) {
    return upstreamFailure(e);
  }
}
