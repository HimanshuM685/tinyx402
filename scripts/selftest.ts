// Minimal asserts on the money path + parsers. Run: pnpm selftest
import assert from "node:assert/strict";

process.env.PAY_TO_ADDRESS ||= "0x000000000000000000000000000000000000dEaD";

async function main() {
  const { paid } = await import("../lib/x402");
  const { PRICES } = await import("../lib/pricing");
  const { encodeSse, readSse } = await import("../lib/sse");
  const { quote } = await import("../lib/pricing");
  const { agentPayload, relayAgent } = await import("../lib/agent");
  const { DatasetBody, AgentBody, ResearchBody } = await import("../lib/schemas");

  // Prices: exact base units from the spec.
  assert.deepEqual(PRICES, { search: "10000", fetch: "15000", agent: "50000", research: "200000", browser: "30000", datasets: "20000" });

  // Route config: explicit asset/amount/extra price, correct network.
  const cfg = paid("search", "t");
  const a = Array.isArray(cfg.accepts) ? cfg.accepts[0] : cfg.accepts;
  assert.equal(a.scheme, "exact");
  assert.equal(a.network, "eip155:1874");
  assert.deepEqual(a.price, {
    asset: "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7",
    amount: "10000",
    extra: { name: "Tether USD", version: "1" },
  });

  // SSE round trip, including chunk boundaries mid-event.
  const raw = encodeSse("step", { n: 1 }) + encodeSse("payment", { tx: "0xabc" });
  const bytes = new TextEncoder().encode(raw);
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(bytes.slice(0, 7));
      c.enqueue(bytes.slice(7));
      c.close();
    },
  });
  const evs = [];
  for await (const e of readSse(stream)) evs.push(e);
  assert.deepEqual(evs, [{ event: "step", data: { n: 1 } }, { event: "payment", data: { tx: "0xabc" } }]);

  // Dynamic quotes.
  assert.equal(quote("research", { mode: "deep" }), "200000");
  assert.equal(quote("research", { mode: "max" }), "500000");
  assert.equal(quote("datasets", { target_rows: 25 }), "500000");
  assert.equal(quote("datasets", {}), "200000"); // default 10 rows
  assert.equal(quote("datasets", { target_rows: 9999 }), "5000000"); // clamped to 250
  assert.equal(quote("datasets", { target_rows: -3 }), "20000");
  const r = paid("research", "t");
  const ra = Array.isArray(r.accepts) ? r.accepts[0] : r.accepts;
  assert.equal(typeof ra.price, "function");

  // Account-scoped TinyFish fields are stripped; agent runs are capped under our function limit.
  const ag = AgentBody.parse({ url: "x.com", goal: "g", use_vault: true, profile_id: "p", agent_config: { max_steps: 10 } });
  assert.equal("use_vault" in ag || "profile_id" in ag, false);
  assert.equal(agentPayload(ag).agent_config.max_duration_seconds, 780);
  assert.equal("prior_run_id" in ResearchBody.parse({ query: "q", prior_run_id: "x", session_id: "y" }), false);
  assert.equal(DatasetBody.safeParse({ target_rows: 5 }).success, false); // needs prompt or spec
  assert.equal(DatasetBody.parse({ prompt: "cafes in Oakland" }).target_rows, 10);

  // Agent SSE relay: COMPLETED resolves, FAILED throws.
  const sse = (lines: object[]) =>
    new Response(lines.map((l) => `data: ${JSON.stringify(l)}\n\n`).join("") + ": ping\n\n");
  const seen: string[] = [];
  const ok = await relayAgent(sse([{ type: "STARTED" }, { type: "HEARTBEAT" }, { type: "COMPLETE", status: "COMPLETED", result: { a: 1 } }]), (e) => seen.push(e));
  assert.deepEqual(seen, ["started", "complete"]);
  assert.deepEqual((ok as { result: unknown }).result, { a: 1 });
  await assert.rejects(relayAgent(sse([{ type: "COMPLETE", status: "FAILED", error: "boom" }]), () => {}), /boom/);
  await assert.rejects(relayAgent(sse([{ type: "STARTED" }]), () => {}), /ended before/);

  console.log("selftest ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
