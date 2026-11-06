import Link from "next/link";
import { Code } from "@/components/code";
import { ENDPOINTS, PRICES } from "@/lib/pricing";
import { formatUsdt, USDT, FACILITATOR_URL } from "@/lib/chains";

const SNIPPET = `import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const paidFetch = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:1874", client: new ExactEvmScheme(account) }],
  spendControls: {
    allowedAssets: [{
      network: "eip155:1874",
      asset: "${USDT.address}",
      maxAmountPerPayment: "100000",
    }],
  },
});

const res = await paidFetch("https://your-domain.com/api/v1/search?query=x402");
console.log(await res.json());`;

const FLOW = [
  { k: "01", t: "Request", d: "Call any endpoint. No key, no account, no signup." },
  { k: "02", t: "402 Payment Required", d: "The server answers with a PAYMENT-REQUIRED header: price, asset, pay-to." },
  { k: "03", t: "Sign, don't send", d: "Your wallet signs an EIP-3009 authorization. Gasless; the facilitator submits it." },
  { k: "04", t: "Result + receipt", d: "Retry returns the result with a PAYMENT-RESPONSE header carrying the tx hash." },
];

export default function Home() {
  return (
    <main>
      <section className="mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:pt-24">
        <div className="flex flex-col justify-center">
          <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
            <span className="size-1.5 rounded-full bg-accent" /> Live on Whitechain Sepolia · x402 v2
          </p>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-6xl">
            The web, as an API.
            <br />
            <span className="text-muted">Paid per call.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            TinyFish search, fetch, browser agents, research and datasets for your scripts and AI agents. Every request
            settles in USDT on Whitechain through x402. No API keys, no subscriptions, no invoices.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/playground" className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink hover:opacity-90">
              Open playground
            </Link>
            <Link href="/docs" className="rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-medium hover:bg-surface-2">
              Quick start
            </Link>
          </div>
          <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-line pt-6 text-sm">
            <div>
              <dt className="text-muted">From</dt>
              <dd className="mt-1 font-mono text-base">{formatUsdt(PRICES.search)} USDT</dd>
            </div>
            <div>
              <dt className="text-muted">Gas for payer</dt>
              <dd className="mt-1 font-mono text-base">0</dd>
            </div>
            <div>
              <dt className="text-muted">Charged on error</dt>
              <dd className="mt-1 font-mono text-base">never</dd>
            </div>
          </dl>
        </div>
        <div className="min-w-0">
          <Code code={SNIPPET} lang="ts" title="agent.ts" />
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">Price list</h2>
            <p className="text-sm text-muted">USDT, 6 decimals. Settled only when the response succeeds.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="py-3 pr-4 font-medium">Endpoint</th>
                  <th className="py-3 pr-4 font-medium">What it does</th>
                  <th className="py-3 pr-4 text-right font-medium">Base units</th>
                  <th className="py-3 text-right font-medium">USDT</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-0">
                    <td className="py-3.5 pr-4">
                      <Link href={`/docs/api/${e.id}`} className="font-mono hover:text-accent">
                        <span className="mr-2 text-[11px] text-muted">{e.method}</span>
                        {e.path}
                      </Link>
                    </td>
                    <td className="py-3.5 pr-4 text-muted">{e.description}</td>
                    <td className="py-3.5 pr-4 text-right font-mono text-muted">{PRICES[e.product]}</td>
                    <td className="py-3.5 text-right font-mono">
                      {formatUsdt(PRICES[e.product])}
                      {e.priceNote && <span className="block text-[11px] text-muted">{e.priceNote}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="mb-8 text-2xl font-semibold tracking-tight">How a paid request works</h2>
        <ol className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {FLOW.map((f) => (
            <li key={f.k} className="bg-bg p-6">
              <span className="font-mono text-xs text-accent">{f.k}</span>
              <h3 className="mt-3 font-medium">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-muted">
          Facilitator <code className="font-mono text-ink">{FACILITATOR_URL}</code> · Asset{" "}
          <code className="break-all font-mono text-ink">{USDT.address}</code>
        </p>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:px-6">
          <span>tinyx402 · open source · testnet</span>
          <div className="flex gap-5">
            <Link href="/docs" className="hover:text-ink">Docs</Link>
            <Link href="/api/openapi" className="hover:text-ink">OpenAPI</Link>
            <Link href="/llms.txt" className="hover:text-ink">llms.txt</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
