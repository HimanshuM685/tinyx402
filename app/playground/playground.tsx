"use client";
import { useMemo, useRef, useState } from "react";
import { useAccount, useReadContract, useSwitchChain, useWalletClient, useBalance } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ENDPOINTS, quote } from "@/lib/pricing";
import { USDT, whitechainSepolia, explorerTx, formatUsdt } from "@/lib/chains";
import { erc20Abi } from "@/lib/wagmi";
import { createPaidFetch, walletSigner, platformSigner, readSettlement, saveRun, type PayEvent, type Settlement } from "@/lib/pay-client";
import { usePlatformWallet, GoogleButton } from "@/components/account";
import { CopyButton } from "@/components/copy-button";
import { readSse } from "@/lib/sse";
import { FIELDS, DEFAULTS, NOTES, buildRequest, type Id, type Form, type Value, type FieldSpec } from "@/lib/playground";

const now = () => performance.now(); // called from event handlers only
const newId = () => crypto.randomUUID();

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
  const platform = usePlatformWallet().data;
  const [source, setSource] = useState<"platform" | "browser">("platform");
  // Google platform wallet when signed in (unless the user picks their browser wallet).
  const onPlatform = !!platform && (source === "platform" || !isConnected);
  const payer = onPlatform ? platform.address : address;
  const [id, setId] = useState<Id>("search");
  const [forms, setForms] = useState(DEFAULTS);
  const [cap, setCap] = useState("0.25");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const [events, setEvents] = useState<{ event: string; data: unknown }[]>([]);
  const [result, setResult] = useState<{ status: number; body: unknown } | null>(null);
  const [settle, setSettle] = useState<Settlement | null>(null);
  const [live, setLive] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const ep = ENDPOINTS.find((e) => e.id === id)!;
  const form = forms[id];
  const set = (k: string, v: string | boolean) => setForms((s) => ({ ...s, [id]: { ...s[id], [k]: v } }));

  const bal = useReadContract({
    address: USDT.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: payer ? [payer] : undefined,
    chainId: whitechainSepolia.id,
    query: { enabled: !!payer },
  });
  const wbt = useBalance({ address: payer, chainId: whitechainSepolia.id, query: { enabled: !!payer } });
  const usdt = bal.data as bigint | undefined;
  const wrongChain = !onPlatform && isConnected && chainId !== whitechainSepolia.id;
  const signer = onPlatform ? platformSigner(platform.address) : wallet ? walletSigner(wallet) : null;
  const req = useMemo(() => buildRequest(id, form), [id, form]);
  const price = quote(ep.product, "error" in req ? forms[id] : req.body);
  const capBase = Math.round(Number(cap) * 10 ** USDT.decimals);
  const overCap = capBase < Number(price);
  const lowBalance = usdt !== undefined && usdt < BigInt(price);


  async function run() {
    if (!signer || "error" in req) return;
    setBusy(true);
    setLog([]);
    setEvents([]);
    setResult(null);
    setSettle(null);
    setLive(null);
    const push = (e: PayEvent) => setLog((l) => [...l, describe(e)]);
    const abort = new AbortController();
    abortRef.current = abort;
    const started = now();
    let body: unknown = null;
    let status = 0;
    let s: Settlement | null = null;
    try {
      const paidFetch = createPaidFetch(signer, push, String(capBase));
      const res = await paidFetch(req.url, { ...req.init, signal: abort.signal });
      status = res.status;
      s = readSettlement(res);
      if (res.headers.get("content-type")?.includes("text/event-stream") && res.body) {
        const evs: { event: string; data: unknown }[] = [];
        for await (const ev of readSse(res.body)) {
          evs.push(ev);
          setEvents([...evs]);
          if (ev.event === "complete" || ev.event === "error") body = ev.data;
          if (ev.event === "streaming_url") setLive((ev.data as { streaming_url?: string }).streaming_url ?? null);
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
        payer: s?.payer ?? payer,
        tx: s?.transaction,
        input: req.body,
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
          <Fields key={id} specs={FIELDS[id]} form={form} set={set} />
          {"error" in req && (
            <p role="alert" className="mt-1 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
              {req.error}
            </p>
          )}
          {NOTES[id] && <p className="mt-3 border-t border-line pt-3 text-xs text-muted">{NOTES[id]}</p>}
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 text-sm">
          {platform && isConnected && (
            <Row
              k="Pay from"
              v={
                <select value={source} onChange={(e) => setSource(e.target.value as "platform" | "browser")} className="rounded-md border border-line bg-bg px-2 py-1">
                  <option value="platform">Google wallet</option>
                  <option value="browser">Browser wallet</option>
                </select>
              }
            />
          )}
          {onPlatform && (
            <Row
              k="Google wallet"
              v={
                <span className="flex items-center gap-1.5 font-mono text-xs">
                  {platform.address.slice(0, 6)}…{platform.address.slice(-4)}
                  <CopyButton text={platform.address} />
                </span>
              }
            />
          )}
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

        {!signer ? (
          <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-dashed border-line p-4">
            <ConnectButton label="Connect wallet to run" />
            <span className="text-xs text-muted">or</span>
            <GoogleButton compact />
          </div>
        ) : wrongChain ? (
          <button onClick={() => switchChain({ chainId: whitechainSepolia.id })} className="rounded-lg bg-warn px-4 py-3 text-sm font-medium text-black">
            Switch to Whitechain Sepolia
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={run}
              disabled={busy || !signer || "error" in req || overCap}
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

        {live && (
          <Panel title="Live browser">
            <div className="aspect-video overflow-hidden rounded-lg border border-line bg-code">
              <iframe src={live} title="Live browser view" className="size-full" />
            </div>
            <a href={live} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-accent hover:underline">
              Open in a new tab
            </a>
          </Panel>
        )}

        {events.length > 0 && (
          <Panel title={`Stream · ${events.length} events`}>
            <ol className="max-h-72 space-y-1 overflow-y-auto font-mono text-[12px]">
              {events.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-28 shrink-0 truncate text-accent">{e.event}</span>
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
  const b = body as { event?: string; result?: unknown } | null;
  const report = b?.event === "final_result" && typeof b.result === "string" ? b.result : undefined;
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

function Fields({ specs, form, set }: { specs: FieldSpec[]; form: Form; set: (k: string, v: Value) => void }) {
  const basic = specs.filter((f) => !f.advanced);
  const adv = specs.filter((f) => f.advanced);
  const advSet = adv.some((f) => form[f.key] !== undefined && form[f.key] !== "" && form[f.key] !== false);
  const [open, setOpen] = useState(false);
  const shown = open || advSet; // stays open while any advanced field is set
  return (
    <>
      <FieldGrid specs={basic} form={form} set={set} />
      {adv.length > 0 && (
        <div className="mt-3 rounded-lg border border-line px-3 py-2">
          <button
            type="button"
            aria-expanded={shown}
            onClick={() => setOpen(!shown)}
            className="flex w-full items-center justify-between text-left text-xs font-medium text-muted hover:text-ink"
          >
            Advanced options ({adv.length})
            <span aria-hidden>{shown ? "−" : "+"}</span>
          </button>
          {shown && (
            <div className="mt-3">
              <FieldGrid specs={adv} form={form} set={set} />
            </div>
          )}
        </div>
      )}
    </>
  );
}

function FieldGrid({ specs, form, set }: { specs: FieldSpec[]; form: Form; set: (k: string, v: Value) => void }) {
  return (
    <div className="grid grid-cols-2 gap-x-3">
      {specs.map((f) => (
        <div key={f.key} className={f.half ? "col-span-1" : "col-span-2"}>
          <Control spec={f} value={form[f.key]} onChange={(v) => set(f.key, v)} />
        </div>
      ))}
    </div>
  );
}

function Control({ spec: f, value, onChange }: { spec: FieldSpec; value: Value | undefined; onChange: (v: Value) => void }) {
  const id = `f-${f.key}`;
  if (f.kind === "check")
    return (
      <label htmlFor={id} className="mb-3 flex items-center gap-2 text-sm">
        <input id={id} type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--accent)]" />
        {f.label}
      </label>
    );
  const v = typeof value === "string" ? value : "";
  const control =
    f.kind === "select" ? (
      <select id={id} className={input} value={v} onChange={(e) => onChange(e.target.value)}>
        {f.options!.map((o) => (
          <option key={o} value={o}>
            {o || "(default)"}
          </option>
        ))}
      </select>
    ) : f.kind === "area" || f.kind === "list" || f.kind === "json" ? (
      <textarea
        id={id}
        rows={f.kind === "area" ? 3 : f.kind === "json" ? 4 : 2}
        className={`${input} ${f.kind === "area" ? "" : "font-mono text-[13px]"}`}
        placeholder={f.placeholder}
        value={v}
        onChange={(e) => onChange(e.target.value)}
      />
    ) : (
      <input
        id={id}
        className={input}
        inputMode={f.kind === "number" ? "numeric" : undefined}
        placeholder={f.placeholder}
        value={v}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
        {f.label}
      </label>
      {control}
      {f.hint && <span className="mt-1 block text-[11px] text-muted">{f.hint}</span>}
    </div>
  );
}
