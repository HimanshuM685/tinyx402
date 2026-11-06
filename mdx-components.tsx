import type { MDXComponents } from "mdx/types";
import { isValidElement } from "react";
import Link from "next/link";
import { Code } from "@/components/code";
import { PRICES, type Product } from "@/lib/pricing";
import { formatUsdt } from "@/lib/chains";

function slug(children: React.ReactNode) {
  return String(Array.isArray(children) ? children.join("") : children).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function Price({ product }: { product: Product }) {
  return (
    <span className="rounded-md bg-accent-soft px-1.5 py-0.5 font-mono text-[0.85em] text-accent">
      {formatUsdt(PRICES[product])} USDT
    </span>
  );
}

export function Endpoint({ method, path, product }: { method: string; path: string; product: Product }) {
  return (
    <div className="not-prose my-5 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${method === "GET" ? "bg-accent-soft text-accent" : "bg-surface-2 text-warn"}`}>{method}</span>
      <code className="font-mono text-sm">{path}</code>
      <span className="ml-auto text-xs text-muted">
        <span className="font-mono">{PRICES[product]}</span> base units · <Price product={product} />
      </span>
    </div>
  );
}

export function Callout({ children, type = "note" }: { children: React.ReactNode; type?: "note" | "warn" }) {
  return (
    <div className={`my-5 rounded-xl border px-4 py-3 text-[14px] [&>p]:my-1 ${type === "warn" ? "border-warn/40 bg-warn/5" : "border-accent/30 bg-accent-soft/50"}`}>
      {children}
    </div>
  );
}

export function Steps({ children }: { children: React.ReactNode }) {
  return <div className="my-4 border-l border-line pl-5 [&>h3]:relative [&>h3]:before:absolute [&>h3]:before:-left-[25px] [&>h3]:before:top-1.5 [&>h3]:before:size-2.5 [&>h3]:before:rounded-full [&>h3]:before:bg-accent">{children}</div>;
}

type Hop = [from: string, to: string, msg: string, note?: string];

export function Sequence({ hops }: { hops: Hop[] }) {
  return (
    <ol className="not-prose my-5 overflow-hidden rounded-xl border border-line bg-surface text-[13px]">
      {hops.map(([from, to, msg, note], i) => (
        <li key={i} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 border-b border-line px-4 py-3 last:border-0 sm:grid-cols-[1.5rem_13rem_minmax(0,1fr)]">
          <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
          <span className="font-mono text-xs text-muted">
            {from} {to && <span className="text-accent">→</span>} {to}
          </span>
          <span className="col-start-2 sm:col-start-3">
            <span className="font-mono">{msg}</span>
            {note && <span className="block text-xs text-muted">{note}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

const components: MDXComponents = {
  h2: ({ children }) => <h2 id={slug(children)}>{children}</h2>,
  h3: ({ children }) => <h3 id={slug(children)}>{children}</h3>,
  a: ({ href = "", children }) =>
    href.startsWith("/") ? <Link href={href}>{children}</Link> : <a href={href} target="_blank" rel="noreferrer">{children}</a>,
  pre: ({ children }) => {
    if (isValidElement<{ className?: string; children?: string }>(children)) {
      const lang = children.props.className?.replace("language-", "") || "text";
      return <Code code={String(children.props.children ?? "")} lang={lang} />;
    }
    return <pre>{children}</pre>;
  },
  table: (p) => <div className="overflow-x-auto"><table {...p} /></div>,
  Price,
  Endpoint,
  Callout,
  Steps,
  Sequence,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
