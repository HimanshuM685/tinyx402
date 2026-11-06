import { NextRequest, NextResponse } from "next/server";
import { paidRoute, badRequest, failure } from "@/lib/x402";
import { BrowserBody, issues } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 30;

// Remote CDP sessions are issued by Browserbase, whose connectUrl carries a per-session
// signing key, so we never hand out our provider API key.
export const POST = paidRoute("browser", "Create remote browser session (CDP)", async (req: NextRequest) => {
  const key = process.env.BROWSERBASE_API_KEY;
  const project = process.env.BROWSERBASE_PROJECT_ID;
  if (!key || !project)
    return NextResponse.json(
      { error: "not_configured", message: "Browser sessions are not enabled on this deployment", charged: false },
      { status: 501 },
    );
  const p = BrowserBody.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return badRequest("Invalid body", issues(p.error));
  try {
    const res = await fetch("https://api.browserbase.com/v1/sessions", {
      method: "POST",
      headers: { "X-BB-API-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project, timeout: p.data.timeout_seconds }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Browser provider error: HTTP ${res.status}`);
    const s = (await res.json()) as { id: string; connectUrl: string; expiresAt: string };
    const debug = await fetch(`https://api.browserbase.com/v1/sessions/${s.id}/debug`, { headers: { "X-BB-API-Key": key } })
      .then((r) => (r.ok ? (r.json() as Promise<{ debuggerFullscreenUrl?: string }>) : null))
      .catch(() => null);
    return NextResponse.json({
      session_id: s.id,
      cdp_url: s.connectUrl,
      live_view_url: debug?.debuggerFullscreenUrl ?? null,
      expires_at: s.expiresAt,
      usage: "playwright: chromium.connectOverCDP(cdp_url) / puppeteer: puppeteer.connect({ browserWSEndpoint: cdp_url })",
    });
  } catch (e) {
    return failure(e);
  }
});
