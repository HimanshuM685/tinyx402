/**
 * Pay for any tinyx402 endpoint from a script.
 *   PRIVATE_KEY=0x... pnpm pay search "x402 protocol"
 *   PRIVATE_KEY=0x... pnpm pay fetch https://example.com
 *   PRIVATE_KEY=0x... pnpm pay agent https://news.ycombinator.com "top 3 story titles"
 *   PRIVATE_KEY=0x... pnpm pay research "state of x402 adoption" --stream
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
    allowedAssets: [{ network: "eip155:1874", asset: USDT, maxAmountPerPayment: "250000" }],
  },
});

const [cmd, a, b] = process.argv.slice(2);
const stream = process.argv.includes("--stream");
const post = (path: string, body: unknown) =>
  paidFetch(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function main() {
  const res = await ({
    search: () => paidFetch(`${BASE}/api/v1/search?q=${encodeURIComponent(a)}`),
    fetch: () => post("/api/v1/fetch", { urls: [a], render: false }),
    agent: () => post(stream ? "/api/v1/agent/run-sse" : "/api/v1/agent/run", { url: a, goal: b }),
    research: () => post(`/api/v1/research${stream ? "?stream=1" : ""}`, { query: a, depth: "quick" }),
    browser: () => post("/api/v1/browser", {}),
  }[cmd] ?? (() => { throw new Error("usage: pay <search|fetch|agent|research|browser> ...") }))();

  console.error(`HTTP ${res.status} (payer ${account.address})`);
  if (res.headers.get("content-type")?.includes("event-stream") && res.body) {
    for await (const ev of readSse(res.body)) console.log(ev.event, JSON.stringify(ev.data));
  } else {
    console.log(JSON.stringify(await res.json(), null, 2));
    const h = res.headers.get("PAYMENT-RESPONSE");
    if (h) console.error("settlement:", decodePaymentResponseHeader(h));
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
