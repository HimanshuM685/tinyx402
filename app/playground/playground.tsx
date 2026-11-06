"use client";
import { useMemo, useRef, useState } from "react";
import { useAccount, useReadContract, useSwitchChain, useWalletClient, useBalance } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ENDPOINTS, quote } from "@/lib/pricing";
import { USDT, whitechainSepolia, explorerTx, formatUsdt } from "@/lib/chains";
import { erc20Abi } from "@/lib/wagmi";
import { createPaidFetch, readSettlement, saveRun, type PayEvent, type Settlement } from "@/lib/pay-client";
import { readSse } from "@/lib/sse";

type Id = (typeof ENDPOINTS)[number]["id"];
type Form = Record<string, string | boolean>;

const DEFAULTS: Record<Id, Form> = {
  search: { query: "x402 payment protocol", domain_type: "web", location: "", page: "0", purpose: "" },
  fetch: { urls: "https://en.wikipedia.org/wiki/HTTP_402", format: "markdown", links: false, purpose: "" },
  agent: { url: "https://news.ycombinator.com", goal: "Return the titles and URLs of the top 5 stories as JSON.", output_schema: "", max_steps: "30", browser_profile: "lite" },
  "agent-sse": { url: "https://news.ycombinator.com", goal: "Return the titles and URLs of the top 5 stories as JSON.", output_schema: "", max_steps: "30", browser_profile: "lite" },
  research: { query: "How does the x402 payment protocol work and who is adopting it?", mode: "deep", output_language: "", follow: true },
  datasets: { prompt: "Specialty coffee shops in Oakland with their website and rating", target_rows: "10", follow: true },
  browser: { url: "https://www.tinyfish.ai", timeout_seconds: "300", country_code: "" },
};

const now = () => performance.now(); // called from event handlers only
const newId = () => crypto.randomUUID();
const opt = (v: string | boolean) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

function buildRequest(id: Id, f: Form): { url: string; init: RequestInit; body?: Record<string, unknown> } | { error: string } {
  const ep = ENDPOINTS.find((e) => e.id === id)!;
  const json = (body: Record<string, unknown>) => ({
    url: ep.path,
    body,
    init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  });
  switch (id) {
    case "search": {
      const qs = new URLSearchParams();
      for (const k of ["query", "domain_type", "location", "page", "purpose"]) if (opt(f[k])) qs.set(k, String(f[k]).trim());
      return { url: `${ep.path}?${qs}`, init: { method: "GET" } };
    }
    case "fetch":
      return json({ urls: String(f.urls).split(/\s+/).filter(Boolean), format: f.format, links: !!f.links, purpose: opt(f.purpose) });
    case "agent":
    case "agent-sse": {
      let output_schema;
      if (String(f.output_schema).trim()) {
        try {
          output_schema = JSON.parse(String(f.output_schema));
        } catch {
          return { error: "output_schema is not valid JSON" };
        }
      }
      return json({ url: f.url, goal: f.goal, browser_profile: f.browser_profile, output_schema, agent_config: { max_steps: Number(f.max_steps) } });
    }
    case "research":
      return json({ query: f.query, mode: f.mode, output_language: opt(f.output_language) });
    case "datasets":
      return json({ prompt: f.prompt, target_rows: Number(f.target_rows) });
    case "browser":
      return json({
        url: opt(f.url),
        timeout_seconds: Number(f.timeout_seconds),
        proxy_config: opt(f.country_code) ? { country_code: String(f.country_code).toUpperCase() } : undefined,
      });
    default:
      return { error: "Unknown endpoint" };
  }
}

type LogLine = { t: number; label: string; detail?: string; tone?: "ok" | "warn" | "err" | "muted" };

function describe(e: PayEvent): LogLine {
  const t = Date.now();
  switch (e.kind) {
    case "request":
      return { t, label: `${e.method} ${new URL(e.url).pathname}${e.paid ? "  + PAYMENT-SIGNATURE" : ""}`, tone: "muted" };
    case "response":
      return { t, label: `HTTP ${e.status}`, detail: `${e.ms} ms`, tone: e.status === 402 ? "warn" : e.status < 400 ? "ok" : "err" };
    case "payment-required":
      return { t, label: "Payment requirements received", detail: JSON.stringify(e.requirements, null, 2), tone: "warn" };
    case "signing":
      return { t, label: `Requesting EIP-3009 signature · ${formatUsdt(e.amount)} USDT`, detail: `to ${e.payTo}` };
    case "signed":
      return { t, label: "Authorization signed (no gas)", tone: "ok" };
    case "settled":
      return { t, label: "Settled on-chain", detail: e.transaction, tone: "ok" };
    case "error":
      return { t, label: e.message, tone: "err" };
  }
}

export function Playground() {
  const { address, chainId, isConnected } = useAccount();
  const { data: wallet } = useWalletClient();
  const { switchChain } = useSwitchChain();
  const [id, setId] = useState<Id>("search");
  const [forms, setForms] = useState(DEFAULTS);
  const [cap, setCap] = useState("0.25");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const [events, setEvents] = useState<{ event: string; data: unknown }[]>([]);
  const [result, setResult] = useState<{ status: number; body: unknown } | null>(null);
  const [settle, setSettle] = useState<Settlement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const ep = ENDPOINTS.find((e) => e.id === id)!;
  const form = forms[id];
  const set = (k: string, v: string | boolean) => setForms((s) => ({ ...s, [id]: { ...s[id], [k]: v } }));

  const bal = useReadContract({
    address: USDT.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: whitechainSepolia.id,
    query: { enabled: !!address },
  });
  const wbt = useBalance({ address, chainId: whitechainSepolia.id, query: { enabled: !!address } });
  const usdt = bal.data as bigint | undefined;
  const wrongChain = isConnected && chainId !== whitechainSepolia.id;
  const req = useMemo(() => buildRequest(id, form), [id, form]);
  const price = quote(ep.product, "error" in req ? undefined : req.body);
  const capBase = Math.round(Number(cap) * 10 ** USDT.decimals);
  const overCap = capBase < Number(price);
  const lowBalance = usdt !== undefined && usdt < BigInt(price);


  async function run() {
    if (!wallet || "error" in req) return;
    setBusy(true);
    setLog([]);
    setEvents([]);
    setResult(null);
    setSettle(null);
    const push = (e: PayEvent) => setLog((l) => [...l, describe(e)]);
    const abort = new AbortController();
    abortRef.current = abort;
    const started = now();
    let body: unknown = null;
    let status = 0;
    let s: Settlement | null = null;
    try {
      const paidFetch = createPaidFetch(wallet, push, String(capBase));
      const res = await paidFetch(req.url, { ...req.init, signal: abort.signal });
      status = res.status;
      s = readSettlement(res);
      if (res.headers.get("content-type")?.includes("text/event-stream") && res.body) {
        const evs: { event: string; data: unknown }[] = [];
        for await (const ev of readSse(res.body)) {
          evs.push(ev);
          setEvents([...evs]);
          if (ev.event === "result") body = ev.data;
          if (ev.event === "error") body = ev.data;
          if (ev.event === "payment") {
            const p = ev.data as Settlement & { success: boolean };
            if (p.success) s = p;
            else push({ kind: "error", message: `Settlement failed: ${(p as { errorReason?: string }).errorReason ?? "unknown"}` });
          }
        }
      } else {
        body = await res.json().catch(() => null);
      }
      setResult({ status, body });
      if (s?.transaction) {
        push({ kind: "settled", transaction: s.transaction, payer: s.payer, network: s.network });
        setSettle(s);
      }
      // Research and Datasets run in the background; follow their free event streams.
      const eventsUrl = (body as { events_url?: string } | null)?.events_url;
      if (status < 400 && eventsUrl && form.follow) {
        const evs: { event: string; data: unknown }[] = [];
        // Each stream request lives at most 5 min on Vercel; reconnect until the run finishes (~1h max).
        let finished = false;
        for (let attempt = 0; attempt < 12 && !finished && !abort.signal.aborted; attempt++) {
          const r = await fetch(eventsUrl, { signal: abort.signal }).catch(() => null);
          if (!r?.ok || !r.body) break;
          for await (const ev of readSse(r.body)) {
            const name = (ev.data as { event?: string })?.event ?? ev.event;
            if (name === "heartbeat") continue;
            evs.push({ event: name, data: ev.data });
            setEvents([...evs]);
            if (name === "final_result") setResult({ status, body: ev.data });
            if (name === "done") finished = true;
          }
        }
        const rowsUrl = (body as { rows_url?: string }).rows_url;
        if (rowsUrl) setResult({ status, body: await (await fetch(rowsUrl)).json() });
      }
      saveRun({
        id: newId(),
        at: Math.round(performance.timeOrigin + now()),
        endpoint: ep.path,
        amount: s?.transaction ? price : "0",
        status,
        ms: Math.round(now() - started),
        payer: s?.payer ?? address,
        tx: s?.transaction,
        input: req.init.body ? JSON.parse(String(req.init.body)) : Object.fromEntries(new URL(req.url, location.href).searchParams),
        output: body,
      });
    } catch (e) {
      const msg = (e as Error).message;
      push({ kind: "error", message: /User rejected|denied/i.test(msg) ? "Signature rejected in wallet" : msg });
    } finally {
      setBusy(false);
      abortRef.current = null;
      bal.refetch();
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      {/* Left: request builder */}
      <section className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 rounded-xl border border-line bg-surface p-1" role="tablist">
          {ENDPOINTS.map((e) => (
            <button
              key={e.id}
              role="tab"
              aria-selected={id === e.id}
              onClick={() => setId(e.id as Id)}
              className={`whitespace-nowrap rounded-lg px-2 py-1.5 text-sm ${id === e.id ? "bg-accent text-accent-ink" : "text-muted hover:bg-surface-2 hover:text-ink"}`}
            >
              {e.title}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="mb-4 flex items-center gap-2 font-mono text-xs">
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-muted">{ep.method}</span>
            <span className="truncate">{ep.path}</span>
          </div>
          <Fields id={id} form={form} set={set} />
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 text-sm">
          <Row k="Cost" v={<span className="font-mono">{formatUsdt(price)} USDT</span>} />
          <Row
            k="Your USDT"
            v={<span className={`font-mono ${lowBalance ? "text-danger" : ""}`}>{usdt === undefined ? "–" : formatUsdt(usdt)}</span>}
          />
          <Row k="Your WBT (not needed)" v={<span className="font-mono text-muted">{wbt.data ? Number(wbt.data.formatted).toFixed(4) : "–"}</span>} />
          <Row
            k={<label htmlFor="cap">Spend cap / payment</label>}
            v={
              <span className="flex items-center gap-1.5">
                <input
                  id="cap"
                  inputMode="decimal"
                  value={cap}
                  onChange={(e) => setCap(e.target.value)}
                  className="w-20 rounded-md border border-line bg-bg px-2 py-1 text-right font-mono"
                />
                <span className="text-muted">USDT</span>
              </span>
            }
          />
          {overCap && <p className="mt-2 text-xs text-warn">Cap is below this endpoint&apos;s price; the client will refuse to pay.</p>}
          {lowBalance && <p className="mt-2 text-xs text-danger">Not enough test USDT. See the docs for how to get some.</p>}
        </div>

        {!isConnected ? (
          <div className="flex justify-center rounded-xl border border-dashed border-line p-4">
            <ConnectButton label="Connect wallet to run" />
          </div>
        ) : wrongChain ? (
          <button onClick={() => switchChain({ chainId: whitechainSepolia.id })} className="rounded-lg bg-warn px-4 py-3 text-sm font-medium text-black">
            Switch to Whitechain Sepolia
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={run}
              disabled={busy || !wallet || "error" in req || overCap}
              className="flex-1 rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Running…" : `Run with x402 · ${formatUsdt(price)} USDT`}
            </button>
            {busy && (
              <button onClick={() => abortRef.current?.abort()} className="rounded-lg border border-line px-4 text-sm">
                Stop
              </button>
            )}
          </div>
        )}
        {"error" in req && <p className="text-xs text-danger">{req.error}</p>}
      </section>

      {/* Right: payment timeline + response */}
      <section className="flex min-w-0 flex-col gap-4">
        <Panel title="Payment flow">
          {log.length === 0 ? (
            <p className="text-sm text-muted">
              Run a request to see the x402 handshake: 402, signature, paid retry, settlement.
            </p>
          ) : (
            <ol className="space-y-2">
              {log.map((l, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${
                      l.tone === "ok" ? "bg-accent" : l.tone === "warn" ? "bg-warn" : l.tone === "err" ? "bg-danger" : "bg-line"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[13px]">{l.label}</div>
                    {l.detail &&
                      (l.detail.startsWith("{") ? (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-muted">decoded PAYMENT-REQUIRED</summary>
                          <pre className="mt-1 overflow-x-auto rounded-lg bg-code p-2 text-[12px]">{l.detail}</pre>
                        </details>
                      ) : (
                        <div className="break-all font-mono text-xs text-muted">{l.detail}</div>
                      ))}
                  </div>
                </li>
              ))}
            </ol>
          )}
          {settle && (
            <div className="mt-4 rounded-lg border border-accent/30 bg-accent-soft/60 p-3 text-sm">
              <div className="font-medium">Paid {formatUsdt(price)} USDT</div>
              <a href={explorerTx(settle.transaction)} target="_blank" rel="noreferrer" className="mt-1 block break-all font-mono text-xs text-accent underline">
                {settle.transaction}
              </a>
              <div className="mt-1 font-mono text-xs text-muted">payer {settle.payer}</div>
            </div>
          )}
        </Panel>

        {events.length > 0 && (
          <Panel title={`Stream · ${events.length} events`}>
            <ol className="max-h-72 space-y-1 overflow-y-auto font-mono text-[12px]">
              {events.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-16 shrink-0 text-accent">{e.event}</span>
                  <span className="truncate text-muted">{JSON.stringify(e.data)}</span>
                </li>
              ))}
            </ol>
          </Panel>
        )}

        <Panel title={result ? `Response · HTTP ${result.status}` : "Response"}>
          {result ? <ResultView body={result.body} /> : <p className="text-sm text-muted">Nothing yet.</p>}
        </Panel>
      </section>
    </div>
  );
}

function ResultView({ body }: { body: unknown }) {
  const b = body as { report?: string; event?: string; result?: unknown } | null;
  const report = b?.report ?? (b?.event === "final_result" && typeof b.result === "string" ? b.result : undefined);
  const [raw, setRaw] = useState(!report);
  return (
    <div>
      {report && (
        <div className="mb-2 flex gap-2 text-xs">
          <button onClick={() => setRaw(false)} className={raw ? "text-muted" : "text-accent"}>Report</button>
          <button onClick={() => setRaw(true)} className={raw ? "text-accent" : "text-muted"}>JSON</button>
        </div>
      )}
      {report && !raw ? (
        <div className="max-h-[560px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">{report}</div>
      ) : (
        <pre className="max-h-[560px] overflow-auto rounded-lg bg-code p-3 font-mono text-[12px] leading-5">{JSON.stringify(body, null, 2)}</pre>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="border-b border-line px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">{title}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-muted">{k}</span>
      {v}
    </div>
  );
}

const input = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="mb-3 block last:mb-0">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

function Fields({ id, form, set }: { id: Id; form: Form; set: (k: string, v: string | boolean) => void }) {
  const text = (k: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input className={input} value={String(form[k] ?? "")} onChange={(e) => set(k, e.target.value)} {...props} />
  );
  const area = (k: string, rows = 3, ph = "") => (
    <textarea className={`${input} font-mono text-[13px]`} rows={rows} placeholder={ph} value={String(form[k] ?? "")} onChange={(e) => set(k, e.target.value)} />
  );
  const check = (k: string, label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={!!form[k]} onChange={(e) => set(k, e.target.checked)} className="accent-[var(--accent)]" />
      {label}
    </label>
  );
  const select = (k: string, opts: string[]) => (
    <select className={input} value={String(form[k])} onChange={(e) => set(k, e.target.value)}>
      {opts.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
  switch (id) {
    case "search":
      return (
        <>
          <Field label="Query">{text("query")}</Field>
          <Field label="Domain type">{select("domain_type", ["web", "news", "research_paper"])}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Location (country)">{text("location", { placeholder: "US", maxLength: 2 })}</Field>
            <Field label="Page">{text("page", { type: "number", min: 0, max: 10 })}</Field>
          </div>
          <Field label="Purpose (optional)">{text("purpose", { placeholder: "Why you are searching" })}</Field>
        </>
      );
    case "fetch":
      return (
        <>
          <Field label="URLs" hint="One per line, up to 10">{area("urls", 3)}</Field>
          <Field label="Format">{select("format", ["markdown", "html", "json"])}</Field>
          <Field label="Purpose (optional)">{text("purpose")}</Field>
          {check("links", "Include outbound links")}
        </>
      );
    case "agent":
    case "agent-sse":
      return (
        <>
          <Field label="Start URL">{text("url")}</Field>
          <Field label="Goal">{area("goal", 3)}</Field>
          <Field label="Output schema (optional JSON Schema)">{area("output_schema", 3, '{"type":"object","properties":{...}}')}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max steps">{text("max_steps", { type: "number", min: 1, max: 500 })}</Field>
            <Field label="Browser">{select("browser_profile", ["lite", "stealth"])}</Field>
          </div>
        </>
      );
    case "research":
      return (
        <>
          <Field label="Question">{area("query", 3)}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mode" hint="max costs more">{select("mode", ["deep", "max"])}</Field>
            <Field label="Report language">{text("output_language", { placeholder: "en" })}</Field>
          </div>
          {check("follow", "Follow progress after paying (5-45 min)")}
        </>
      );
    case "datasets":
      return (
        <>
          <Field label="Describe the dataset">{area("prompt", 3)}</Field>
          <Field label="Target rows" hint="Priced per row, 1-250">{text("target_rows", { type: "number", min: 1, max: 250 })}</Field>
          {check("follow", "Follow the fill, then load rows")}
        </>
      );
    case "browser":
      return (
        <>
          <Field label="Start URL (optional)">{text("url")}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Idle timeout (s)">{text("timeout_seconds", { type: "number", min: 5, max: 3600 })}</Field>
            <Field label="Proxy country">{text("country_code", { placeholder: "US", maxLength: 2 })}</Field>
          </div>
        </>
      );
  }
}
