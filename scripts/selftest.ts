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

  // Route config: the chain comes from the URL, so each route quotes EXACTLY ONE asset — its
  // own. Quoting a chain the caller did not ask for is the bug this guards.
  const { CHAINS, NETWORKS, MIN_PAYMENT, apiPath, networkOfSlug } = await import("../lib/chains");
  const { ADVERTISED } = await import("../lib/chain-guard");
  for (const n of ADVERTISED) {
    const cfg = paid("search", "t", n);
    const opts = Array.isArray(cfg.accepts) ? cfg.accepts : [cfg.accepts];
    assert.equal(opts.length, 1, `${n} must quote exactly one asset`);
    assert.equal(opts[0].network, n);
    assert.equal(opts[0].scheme, "exact");
    assert.deepEqual(opts[0].price, { asset: CHAINS[n].asset.address, amount: "10000", extra: CHAINS[n].asset.extra });
  }

  // Slug <-> network round trip, and the composed public path.
  for (const n of NETWORKS) assert.equal(networkOfSlug(CHAINS[n].slug), n);
  assert.equal(networkOfSlug("nope"), undefined);

  // isNetwork is the allowlist /api/wallet/sign builds its EIP-712 domain from, so it must not
  // accept inherited keys. `n in CHAINS` used to let these through and then crash on CHAINS[n].
  const { isNetwork } = await import("../lib/chains");
  for (const n of NETWORKS) assert.ok(isNetwork(n));
  for (const bad of ["toString", "constructor", "__proto__", "hasOwnProperty", "valueOf", "", "eip155:9"]) {
    assert.equal(isNetwork(bad), false, `isNetwork accepted ${JSON.stringify(bad)}`);
  }
  assert.equal(apiPath("eip155:5042002", "/v1/search"), "/api/arc/v1/search");
  assert.equal(apiPath("eip155:1874", "/v1/search"), "/api/whitechain/v1/search");

  // Arc's USDC entry must match the x402 SDK's own table, or signatures verify to nobody.
  const { getDefaultAsset } = await import("@x402/evm");
  const arc = CHAINS["eip155:5042002"];
  const sdk = getDefaultAsset("eip155:5042002") as { asset: string; name: string; version: string; decimals: number };
  assert.equal(arc.asset.address.toLowerCase(), sdk.asset.toLowerCase());
  assert.deepEqual(arc.asset.extra, { name: sdk.name, version: sdk.version });
  assert.equal(arc.asset.decimals, sdk.decimals);

  // One scalar MAX_PLATFORM_PAYMENT and one shared price table are only valid while every
  // asset has the same decimals. Fail loudly rather than overcharging by 10^12.
  for (const n of NETWORKS) assert.equal(CHAINS[n].asset.decimals, 6, `${n} is not 6 decimals`);

  // Arc rejects anything under 0.01 USDC with amount_below_minimum.
  for (const [k, v] of Object.entries(PRICES)) assert.ok(BigInt(v) >= MIN_PAYMENT, `${k} below Arc minimum`);

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
  const r = paid("research", "t", ADVERTISED[0]);
  const ra = Array.isArray(r.accepts) ? r.accepts[0] : r.accepts;
  assert.equal(typeof ra.price, "function");

  // Account-scoped TinyFish fields are stripped; agent runs are capped under our function limit.
  const ag = AgentBody.parse({ url: "x.com", goal: "g", use_vault: true, profile_id: "p", agent_config: { max_steps: 10 } });
  assert.equal("use_vault" in ag || "profile_id" in ag, false);
  assert.equal(agentPayload(ag).agent_config.max_duration_seconds, 280);
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

  // Playground form -> request: defaults are valid for every endpoint; mapping rules hold.
  const { buildRequest, DEFAULTS, FIELDS } = await import("../lib/playground");
  for (const id of Object.keys(FIELDS)) {
    const r = buildRequest(id, DEFAULTS[id]);
    assert.ok(!("error" in r), `defaults for ${id}: ${"error" in r ? r.error : ""}`);
  }
  const s1 = buildRequest("search", { query: " x402 ", location: "us", page: "", include_thumbnail: true });
  assert.ok(!("error" in s1));
  assert.equal(s1.url, "/v1/search?query=x402&location=US&include_thumbnail=true"); // suffix; caller adds the chain prefix
  const a1 = buildRequest("agent", { url: "x.com", goal: "g", "agent_config.max_steps": "12", "proxy_config.country_code": "de" });
  assert.ok(!("error" in a1));
  assert.deepEqual(a1.body, { url: "x.com", goal: "g", agent_config: { max_steps: 12 }, proxy_config: { country_code: "DE", enabled: true } });
  const f1 = buildRequest("fetch", { urls: "https://a.com\nhttps://b.com", include_selectors: "article, main" });
  assert.ok(!("error" in f1));
  assert.deepEqual(f1.body, { urls: ["https://a.com", "https://b.com"], include_selectors: ["article", "main"] });
  const b1 = buildRequest("browser", { "proxy_config.enabled": true });
  assert.ok(!("error" in b1));
  assert.deepEqual(b1.body, { proxy_config: { enabled: false } }); // "direct egress" checkbox
  assert.equal("error" in buildRequest("agent", { url: "x", goal: "g", "agent_config.max_steps": "1.5" }), true);
  assert.equal("error" in buildRequest("agent", { url: "x", goal: "g", output_schema: "{bad" }), true);
  assert.equal("error" in buildRequest("agent", { url: "x", goal: "g", "agent_config.max_duration_seconds": "900" }), true); // >280
  assert.equal("error" in buildRequest("datasets", { prompt: "cafes", target_rows: "300" }), true);
  assert.equal("error" in buildRequest("search", { query: "q", recency_minutes: "5", after_date: "2026-01-01" }), true);
  const d1 = buildRequest("datasets", { prompt: "x", spec: '{"name":"n","description":"d","columns":[{"name":"a"}]}', follow: true });
  assert.ok(!("error" in d1));
  assert.equal("prompt" in d1.body || "follow" in d1.body, false); // spec wins, local fields never sent

  const { upstreamFailure, UpstreamError } = await import("../lib/tinyfish");
  const why = async (s: number, body: unknown) => (await upstreamFailure(new UpstreamError(s, body)).json()).reason;
  assert.equal(await why(503, { error: "TINYFISH_API_KEY is not configured" }), "operator_key_missing");
  assert.equal(await why(401, null), "operator_key_rejected");
  assert.equal(await why(402, null), "operator_out_of_credits");
  assert.equal(await why(503, null), "upstream_busy");

  // Bazaar discovery docs for every endpoint pass the official validator.
  const { discovery } = await import("../lib/x402");
  const { validateDiscoveryExtension } = await import("@x402/extensions/bazaar");
  const { ENDPOINTS } = await import("../lib/pricing");
  for (const e of ENDPOINTS) {
    const ext = structuredClone(Object.values(discovery(e.id as Parameters<typeof discovery>[0]))[0]);
    (ext.info.input as { method?: string }).method = e.method; // what bazaarResourceServerExtension adds per request
    const v = validateDiscoveryExtension(ext);
    assert.ok(v.valid, `bazaar ${e.id}: ${JSON.stringify(v.errors)}`);
  }

  // Platform wallet: key encryption is bound to the user, signing policy, and the signature
  // must equal what the official x402 EVM client gets from a normal wallet.
  process.env.WALLET_ENCRYPTION_KEY ||= Buffer.alloc(32, 7).toString("base64");
  const w = await import("../lib/wallet");
  const { generatePrivateKey, privateKeyToAccount } = await import("viem/accounts");
  const { ExactEvmScheme: ExactClient } = await import("@x402/evm/exact/client");
  const pk = generatePrivateKey();
  assert.equal(w.decrypt(w.encrypt(pk, "u1"), "u1"), pk);
  assert.throws(() => w.decrypt(w.encrypt(pk, "u1"), "u2")); // row swapped to another user
  const acct = privateKeyToAccount(pk);
  const shop = "0x000000000000000000000000000000000000dEaD";
  // Per chain: the custodial signature must equal what the official x402 client produces from an
  // ordinary wallet on that same chain. Run per network, because the whole risk here is signing
  // one chain's payment under another chain's EIP-712 domain.
  const sigs = new Map<string, string>();
  for (const n of NETWORKS) {
    const c = CHAINS[n];
    const reqs = { scheme: "exact", network: n, asset: c.asset.address, amount: "50000", payTo: shop, maxTimeoutSeconds: 300, extra: c.asset.extra };
    let captured: { primaryType: string; message: Record<string, unknown> } | null = null;
    let direct = "";
    const capture = { address: acct.address, signTypedData: async (m: Parameters<typeof acct.signTypedData>[0]) => { captured = m as never; return (direct = await acct.signTypedData(m)); } };
    await new ExactClient(capture as never).createPaymentPayload(2, reqs as never);
    const m = captured!.message as Record<string, unknown>;
    const chk = w.checkAuthorization({ to: String(m.to), value: String(m.value), validAfter: String(m.validAfter), validBefore: String(m.validBefore), nonce: String(m.nonce), network: n }, acct.address, shop);
    assert.ok("message" in chk, "error" in chk ? chk.error : "");
    assert.equal(chk.network, n);
    assert.equal(await w.signWithKey(pk, chk.message!, n), direct, `${n} custodial signature differs from a normal wallet`);
    sigs.set(n, direct);
  }
  // Same payment, different chain => different signature. This is what makes cross-chain replay
  // impossible, and it only holds because chainId is inside the domain.
  assert.equal(new Set(sigs.values()).size, NETWORKS.length, "signatures collide across chains");

  const base = { to: shop, value: "50000", validAfter: "0", validBefore: String(Math.floor(Date.now() / 1000) + 300), nonce: "0x" + "ab".repeat(32), network: NETWORKS[0] };
  assert.ok("error" in w.checkAuthorization({ ...base, to: "0x1111111111111111111111111111111111111111" }, acct.address, shop)); // other recipient
  assert.ok("error" in w.checkAuthorization({ ...base, value: "999999999" }, acct.address, shop)); // over cap
  assert.ok("error" in w.checkAuthorization({ ...base, validBefore: "99999999999" }, acct.address, shop)); // too long-lived
  assert.ok("error" in w.checkAuthorization({ ...base, nonce: "0x12" }, acct.address, shop));
  // An unknown chain must be refused outright, never signed under some other chain's domain.
  assert.ok("error" in w.checkAuthorization({ ...base, network: "eip155:1" }, acct.address, shop));
  assert.ok("error" in w.checkAuthorization({ ...base, network: "" }, acct.address, shop));

  // Wallet-unavailable hints: each cause must point at its own fix, never at "signed out".
  assert.match(w.walletErrorHint("DATABASE_URL is not set"), /DATABASE_URL/);
  assert.match(w.walletErrorHint('relation "wallets" does not exist'), /db:push/);
  assert.match(w.walletErrorHint("WALLET_ENCRYPTION_KEY must be 32 bytes, base64"), /WALLET_ENCRYPTION_KEY/);
  assert.match(w.walletErrorHint("ECONNREFUSED"), /server logs/);

  // Every URL a handler hands back must be composed with apiPath. Production once renamed the
  // routes but kept `poll_url: `/api/v1/research/${id}``, so every paid research/dataset/browser
  // call returned a 404 link. A static check, because reproducing it needs a real payment.
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const full = `${dir}/${f}`;
      return statSync(full).isDirectory() ? walk(full) : full.endsWith("route.ts") ? [full] : [];
    });
  const routeFiles = walk("app/api");
  assert.ok(routeFiles.length >= 13, `expected the route tree, found ${routeFiles.length} files`);
  for (const f of routeFiles) {
    const src = readFileSync(f, "utf8");
    for (const line of src.split("\n")) {
      if (!/_url(_|\b)|_url:/.test(line) || line.trimStart().startsWith("//") || line.includes("cdp_url") || line.includes("base_url")) continue;
      if (!/_url(s)?\s*[:=]/.test(line)) continue;
      if (line.includes("apiPath(")) continue; // composed from the registry, which is the point
      // Otherwise a literal API path is being handed out, and it will not carry the chain.
      if (/["`]\/(api|v1)\//.test(line)) {
        assert.fail(`${f}: hands out a hardcoded API path, use apiPath(): ${line.trim()}`);
      }
    }
    // And no route may name the retired prefix at all.
    assert.ok(!src.includes("/api/v1/") || f.includes("[...path]"), `${f} still references /api/v1/`);
  }

  // Proxy matcher: every page runs the OAuth verifier exchange, /api/* stays out of it.
  const { config: proxy } = await import("../proxy");
  const matched = (p: string) => new RegExp(`^${proxy.matcher[0]}$`).test(p);
  for (const p of ["/", "/playground", "/docs", "/docs/api/search", "/dashboard", "/llms.txt", "/apikeys"]) {
    assert.ok(matched(p), `${p} skips the proxy, so Google sign-in from it would not set a session`);
  }
  for (const p of ["/api/arc/v1/search", "/api/whitechain/v1/search", "/api/wallet", "/_next/static/chunk.js"]) {
    assert.ok(!matched(p), `${p} should not pay for a session round-trip`);
  }

  // Live x402 check (opt-in): X402_CHECK_URL=http://localhost:3000 pnpm selftest
  const live = process.env.X402_CHECK_URL;
  if (live) {
    const { facilitators } = await import("../lib/x402");
    const { decodePaymentRequiredHeader } = await import("@x402/core/http");
    // Every advertised network must be served by one of the registered facilitators, or
    // initialize() throws RouteConfigurationError and every paid route breaks, not just one.
    const kinds = (await Promise.all(facilitators.map((f) => f.getSupported()))).flatMap((s) => s.kinds);
    for (const n of ADVERTISED)
      assert.ok(kinds.some((k) => k.scheme === "exact" && k.network === n), `no facilitator serves exact/${n}`);
    // The regression that started this: each chain's own path must quote ONLY that chain.
    // Previously one path quoted whatever the server felt like and a client set to Arc got USDT.
    let acc!: { network: string; asset: string; payTo: string; extra: unknown };
    let lastReq!: { extensions?: { bazaar?: unknown } };
    for (const n of ADVERTISED) {
      const u: string = `${live}${apiPath(n, "/v1/search")}?query=x402`;
      const res402: Response = await fetch(u);
      assert.equal(res402.status, 402, `${u} should be 402`);
      const pr = decodePaymentRequiredHeader(res402.headers.get("payment-required") ?? "");
      assert.equal(pr.x402Version, 2);
      assert.equal(pr.accepts.length, 1, `${u} must quote exactly one chain`);
      lastReq = pr;
      acc = pr.accepts[0];
      const c = CHAINS[n];
      assert.equal(acc.network, n, `${u} quoted ${acc.network}`);
      assert.equal(acc.asset.toLowerCase(), c.asset.address.toLowerCase());
      assert.deepEqual(acc.extra, c.asset.extra, `${n} advertises the wrong EIP-712 domain`);
      assert.match(acc.payTo, /^0x[0-9a-fA-F]{40}$/);
    }
    // The pre-multi-chain path is gone and must say so rather than quoting a chain.
    const gone = await fetch(`${live}/api/v1/search?query=x402`);
    assert.equal(gone.status, 410, "/api/v1/* must answer Gone, not quote a chain");
    const goneBody = await gone.json();
    assert.equal(goneBody.error, "endpoint_moved");
    assert.deepEqual(goneBody.paths, ADVERTISED.map((n) => apiPath(n, "/v1/search")));
    const bogus = await fetch(`${live}/api/nope/v1/search?query=x402`);
    assert.equal(bogus.status, 404);
    // Free follow-ups must reject a bogus chain too, or every resource gains unlimited aliases.
    // browser/[id] only accepts DELETE; the wrong verb would 405 before the chain guard runs.
    const freeRoutes: [string, string][] = [
      ["GET", "/v1/research/res_x"],
      ["GET", "/v1/research/res_x/events"],
      ["GET", "/v1/datasets/ds_x"],
      ["GET", "/v1/datasets/ds_x/rows"],
      ["DELETE", "/v1/browser/b_x"],
    ];
    for (const [method, u] of freeRoutes) {
      const r: Response = await fetch(`${live}/api/nope${u}`, { method });
      assert.equal(r.status, 404, `/api/nope${u} must 404 on an unknown chain`);
      assert.equal((await r.json()).error, "unknown_chain", `/api/nope${u} reached upstream`);
    }
    // operationId is unique per document, and each endpoint now appears once per chain.
    const spec = await (await fetch(`${live}/api/openapi`)).json();
    const ids = Object.values(spec.paths as Record<string, Record<string, { operationId?: string }>>)
      .flatMap((ops) => Object.values(ops).map((o) => o.operationId))
      .filter(Boolean);
    assert.equal(new Set(ids).size, ids.length, `duplicate operationIds: ${ids.filter((x, i) => ids.indexOf(x) !== i).join(",")}`);
    const bz = (lastReq.extensions?.bazaar ?? {}) as { info?: { input?: { method?: string; queryParams?: unknown } } };
    assert.equal(bz.info?.input?.method, "GET", "402 lacks enriched bazaar extension");
    console.log(`live x402 ok: facilitator + 402 from ${live} (payTo ${acc.payTo})`);
  }

  console.log("selftest ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
