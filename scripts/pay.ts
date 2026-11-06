/**
 * Pay for any tinyx402 endpoint from a script. NETWORK picks the chain (see lib/chains.ts).
 *   NETWORK=eip155:5042002 PRIVATE_KEY=0x... pnpm pay search "x402 protocol"
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
import { CHAINS, NETWORKS, apiPath, isNetwork, type Network } from "../lib/chains";

const BASE = process.env.TINYX402_URL || "http://localhost:3000";

// Which chain to pay on. Every 402 offers them all, so this has to be chosen, not defaulted —
// NETWORK=eip155:1874 pnpm pay search "…"
const chosen = process.env.NETWORK;
if (!isNetwork(chosen)) {
  throw new Error(`Set NETWORK to one of: ${NETWORKS.join(", ")}`);
}
// Declared type, not just narrowed: main() is hoisted, so narrowing would not reach inside it.
const network: Network = chosen;
const { asset } = CHAINS[network];

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const paidFetch = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network, client: new ExactEvmScheme(account) }],
  spendControls: {
    allowedAssets: [{ network, asset: asset.address, maxAmountPerPayment: process.env.MAX_PER_PAYMENT || "500000" }],
  },
});

const [cmd, a, b] = process.argv.slice(2);
const stream = process.argv.includes("--stream");
const post = (path: string, body: unknown) =>
  paidFetch(`${BASE}${apiPath(network, path)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function main() {
  const res = await ({
    search: () => paidFetch(`${BASE}${apiPath(network, "/v1/search")}?query=${encodeURIComponent(a)}`),
    fetch: () => post("/v1/fetch", { urls: [a] }),
    agent: () => post(stream ? "/v1/agent/run-sse" : "/v1/agent/run", { url: a, goal: b }),
    research: () => post("/v1/research", { query: a, mode: "deep" }),
    datasets: () => post("/v1/datasets", { prompt: a, target_rows: Number(b || 10) }),
    browser: () => post("/v1/browser", a ? { url: a } : {}),
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
      // Each stream request lives at most 5 min on Vercel; reconnect until `done`.
      let finished = false;
      for (let attempt = 0; attempt < 12 && !finished; attempt++) {
        const ev = await fetch(`${BASE}${body.events_url}`);
        if (!ev.ok || !ev.body) break;
        for await (const e of readSse(ev.body)) {
          const name = (e.data as { event?: string })?.event ?? e.event;
          if (name === "done") finished = true;
          if (name !== "heartbeat") console.log(name, JSON.stringify(e.data).slice(0, 300));
        }
      }
      if (body.rows_url) console.log(JSON.stringify(await (await fetch(`${BASE}${body.rows_url}`)).json(), null, 2));
    }
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
