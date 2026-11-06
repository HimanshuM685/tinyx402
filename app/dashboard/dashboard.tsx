"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useMounted } from "@/components/header";
import { clearRuns, loadRuns, type LocalRun } from "@/lib/pay-client";
import { explorerTx, formatUsdt } from "@/lib/chains";

type ServerRun = { id: string; endpoint: string; payer: string | null; amount: string; txHash: string | null; status: number; durationMs: number | null; createdAt: string };
type Row = { key: string; at: number; endpoint: string; amount: string; status: number; ms?: number; tx?: string; payer?: string; source: "browser" | "server"; run?: LocalRun };

export function Dashboard() {
  const { address } = useAccount();
  const mounted = useMounted();
  const [ver, setVer] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const local: LocalRun[] = useMemo(() => (mounted ? loadRuns() : []), [mounted, ver]);
  const [server, setServer] = useState<{ enabled: boolean; runs: ServerRun[] } | null>(null);
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const q = scope === "mine" && address ? `?payer=${address}` : "";
    fetch(`/api/runs${q}`).then((r) => r.json()).then(setServer).catch(() => setServer({ enabled: false, runs: [] }));
  }, [address, scope]);

  const rows = useMemo(() => {
    const out = new Map<string, Row>();
    for (const r of server?.runs ?? [])
      out.set(r.txHash ?? r.id, { key: r.id, at: Date.parse(r.createdAt), endpoint: r.endpoint, amount: r.amount, status: r.status, ms: r.durationMs ?? undefined, tx: r.txHash ?? undefined, payer: r.payer ?? undefined, source: "server" });
    for (const r of local) {
      if (scope === "mine" && address && r.payer && r.payer.toLowerCase() !== address.toLowerCase()) continue;
      const k = r.tx ?? r.id;
      out.set(k, { ...(out.get(k) ?? {}), key: r.id, at: r.at, endpoint: r.endpoint, amount: r.amount, status: r.status, ms: r.ms, tx: r.tx, payer: r.payer, source: "browser", run: r });
    }
    return [...out.values()].sort((a, b) => b.at - a.at);
  }, [local, server, scope, address]);

  const spent = rows.reduce((s, r) => s + (r.tx ? Number(r.amount) : 0), 0);
  const paid = rows.filter((r) => r.tx).length;

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
        <Stat k="Paid runs" v={String(paid)} />
        <Stat k="Total spent" v={`${formatUsdt(BigInt(spent))} USDT`} />
        <Stat k="Server log" v={server == null ? "…" : server.enabled ? "Postgres" : "off (browser only)"} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {(["mine", "all"] as const).map((s) => (
          <button key={s} onClick={() => setScope(s)} className={`rounded-md px-3 py-1.5 ${scope === s ? "bg-surface-2 text-ink" : "text-muted"}`}>
            {s === "mine" ? "My wallet" : "All runs"}
          </button>
        ))}
        <button onClick={() => { clearRuns(); setVer((v) => v + 1); }} className="ml-auto text-xs text-muted hover:text-danger">
          Clear browser history
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Endpoint</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Transaction</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">No runs yet. Try the playground.</td></tr>
            )}
            {rows.map((r) => (
              <Fragment key={r.key}>
                <tr onClick={() => r.run && setOpen(open === r.key ? null : r.key)} className={`border-b border-line last:border-0 ${r.run ? "cursor-pointer hover:bg-surface-2" : ""}`}>
                  <td className="px-4 py-3 whitespace-nowrap text-muted">{new Date(r.at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-[13px]">{r.endpoint}</td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-xs ${r.status < 400 ? "text-accent" : "text-danger"}`}>{r.status}</span>
                    {r.ms != null && <span className="ml-2 text-xs text-muted">{(r.ms / 1000).toFixed(1)}s</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{r.tx ? formatUsdt(r.amount) : "0"}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {r.tx ? (
                      <a href={explorerTx(r.tx)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-accent hover:underline">
                        {r.tx.slice(0, 10)}…{r.tx.slice(-8)}
                      </a>
                    ) : (
                      <span className="text-muted">not charged</span>
                    )}
                  </td>
                </tr>
                {open === r.key && r.run && (
                  <tr className="border-b border-line bg-bg">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <pre className="max-h-64 overflow-auto rounded-lg bg-code p-3 text-[12px]">{JSON.stringify(r.run.input, null, 2)}</pre>
                        <pre className="max-h-64 overflow-auto rounded-lg bg-code p-3 text-[12px]">{JSON.stringify(r.run.output, null, 2)}</pre>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="bg-surface p-5">
      <div className="text-xs uppercase tracking-wider text-muted">{k}</div>
      <div className="mt-2 font-mono text-xl">{v}</div>
    </div>
  );
}
