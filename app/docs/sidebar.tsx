"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DOCS_NAV } from "@/lib/docs-nav";

export function DocsSidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const nav = (
    <nav className="space-y-7 text-sm">
      {DOCS_NAV.map((g) => (
        <div key={g.title}>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">{g.title}</div>
          <ul className="space-y-0.5 border-l border-line">
            {g.items.map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  onClick={() => setOpen(false)}
                  className={`-ml-px block border-l py-1.5 pl-3 ${path === i.href ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}
                >
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div>
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">Machine readable</div>
        <ul className="space-y-1.5 pl-3 text-muted">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a JSON route handler, not a
              page; the rule only flags it because app/api/[chain] makes /api/openapi look routable */}
          <li><a href="/api/openapi" className="hover:text-ink">OpenAPI 3.1</a></li>
          <li><a href="/llms.txt" className="hover:text-ink">llms.txt</a></li>
        </ul>
      </div>
    </nav>
  );
  return (
    <>
      <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 overflow-y-auto py-10 lg:block">{nav}</aside>
      <div className="fixed bottom-4 right-4 z-30 lg:hidden" style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <button onClick={() => setOpen(!open)} className="rounded-full border border-line bg-surface px-4 py-2 text-sm shadow-lg">
          {open ? "Close" : "Docs menu"}
        </button>
      </div>
      {open && <div className="fixed inset-x-0 bottom-0 top-14 z-20 overflow-y-auto bg-bg p-6 lg:hidden">{nav}</div>}
    </>
  );
}
