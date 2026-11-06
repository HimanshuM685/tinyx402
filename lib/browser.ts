import "server-only";
import { chromium, type Browser, type BrowserContext } from "playwright-core";
import { assertPublicUrl } from "./safe-url";

const WS = process.env.BROWSER_WS_ENDPOINT;
let local: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  // Remote CDP (Browserless/Steel/self-hosted): fresh connection per run, provider isolates sessions.
  if (WS) return chromium.connectOverCDP(WS, { timeout: 30_000 });
  local ??= chromium
    .launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined })
    .catch((e) => {
      local = null;
      throw new Error(
        `No browser available. Set BROWSER_WS_ENDPOINT or run \`pnpm exec playwright-core install chromium\`. (${e.message})`,
      );
    });
  return local;
}

/** Run fn with an isolated browser context; always cleans up. Blocks navigation to private hosts. */
export async function withPage<T>(fn: (ctx: BrowserContext) => Promise<T>): Promise<T> {
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 tinyx402",
    viewport: { width: 1280, height: 900 },
  });
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    if (req.isNavigationRequest() && req.frame() === req.frame().page().mainFrame()) {
      try {
        await assertPublicUrl(req.url());
      } catch {
        return route.abort("blockedbyclient");
      }
    }
    const t = req.resourceType();
    if (t === "media" || t === "font") return route.abort();
    return route.continue();
  });
  try {
    return await fn(ctx);
  } finally {
    await ctx.close().catch(() => {});
    if (WS) await browser.close().catch(() => {});
  }
}
