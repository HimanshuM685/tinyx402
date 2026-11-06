// Minimal asserts on the money path + parsers. Run: pnpm selftest
import assert from "node:assert/strict";

process.env.PAY_TO_ADDRESS ||= "0x000000000000000000000000000000000000dEaD";

async function main() {
  const { paid } = await import("../lib/x402");
  const { PRICES } = await import("../lib/pricing");
  const { encodeSse, readSse } = await import("../lib/sse");
  const { normalize, parseDdg } = await import("../lib/search");
  const { isPrivateIp, assertPublicUrl } = await import("../lib/safe-url");

  // Prices: exact base units from the spec.
  assert.deepEqual(PRICES, { search: "10000", fetch: "15000", agent: "50000", research: "200000", browser: "30000" });

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

  // Search normalizer: dedupe, drop non-http, strip tags, positions.
  const n = normalize(
    [
      { title: "<b>A</b>", url: "https://www.a.com/x", snippet: "s  1" },
      { title: "dup", url: "https://www.a.com/x" },
      { title: "bad", url: "javascript:alert(1)" },
      { title: "B", url: "https://b.org" },
    ],
    10,
  );
  assert.deepEqual(n.map((r) => [r.position, r.title, r.source, r.snippet]), [[1, "A", "a.com", "s 1"], [2, "B", "b.org", ""]]);
  const ddg = parseDdg(
    `<div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fx402.org%2F&rut=1">x402</a><a class="result__snippet">Open protocol</a></div>`,
    5,
  );
  assert.equal(ddg[0].url, "https://x402.org/");

  // SSRF guard.
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "::1", "fd00::1", "::ffff:127.0.0.1"])
    assert.equal(isPrivateIp(ip), true, ip);
  for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700::1111"]) assert.equal(isPrivateIp(ip), false, ip);
  await assert.rejects(assertPublicUrl("http://localhost:3000"));
  await assert.rejects(assertPublicUrl("file:///etc/passwd"));
  await assert.rejects(assertPublicUrl("http://169.254.169.254/latest/meta-data"));

  console.log("selftest ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
