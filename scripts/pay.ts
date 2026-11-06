/**
 * Pay for any tinyx402 endpoint from a script.
 *   PRIVATE_KEY=0x... pnpm pay search "x402 protocol"
 *   PRIVATE_KEY=0x... pnpm pay fetch https://example.com
 *   PRIVATE_KEY=0x... pnpm pay agent https://news.ycombinator.com "top 3 story titles"
 *   PRIVATE_KEY=0x... pnpm pay research "state of x402 adoption"     (then follows free events)
 *   PRIVATE_KEY=0x... pnpm pay datasets "Coffee shops in Oakland with website" 10
 *   PRIVATE_KEY=0x... pnpm pay browser https://www.tinyfish.ai
 */
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { readSse } from "../lib/sse";

const BASE = process.env.TINYX402_URL || "http://localhost:3000";
const USDT = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const paidFetch = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:1874", client: new ExactEvmScheme(account) }],
  spendControls: {
    allowedAssets: [{ network: "eip155:1874", asset: USDT, maxAmountPerPayment: process.env.MAX_PER_PAYMENT || "500000" }],
  },
});

const [cmd, a, b] = process.argv.slice(2);
const stream = process.argv.includes("--stream");
const post = (path: string, body: unknown) =>
  paidFetch(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function main() {
  const res = await ({
    search: () => paidFetch(`${BASE}/api/v1/search?query=${encodeURIComponent(a)}`),
    fetch: () => post("/api/v1/fetch", { urls: [a] }),
    agent: () => post(stream ? "/api/v1/agent/run-sse" : "/api/v1/agent/run", { url: a, goal: b }),
    research: () => post("/api/v1/research", { query: a, mode: "deep" }),
    datasets: () => post("/api/v1/datasets", { prompt: a, target_rows: Number(b || 10) }),
    browser: () => post("/api/v1/browser", a ? { url: a } : {}),
  }[cmd] ?? (() => { throw new Error("usage: pay <search|fetch|agent|research|datasets|browser> ...") }))();

  console.error(`HTTP ${res.status} (payer ${account.address})`);
  if (res.headers.get("content-type")?.includes("event-stream") && res.body) {
    for await (const ev of readSse(res.body)) console.log(ev.event, JSON.stringify(ev.data));
  } else {
    const body = await res.json();
    console.log(JSON.stringify(body, null, 2));
    const h = res.headers.get("PAYMENT-RESPONSE");
    if (h) console.error("settlement:", decodePaymentResponseHeader(h));
    // Research / Datasets keep running; follow the free event stream.
    if (res.ok && body.events_url) {
      const ev = await fetch(`${BASE}${body.events_url}`);
      if (ev.body) for await (const e of readSse(ev.body)) console.log((e.data as { event?: string })?.event ?? e.event, JSON.stringify(e.data).slice(0, 300));
      if (body.rows_url) console.log(JSON.stringify(await (await fetch(`${BASE}${body.rows_url}`)).json(), null, 2));
    }
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
