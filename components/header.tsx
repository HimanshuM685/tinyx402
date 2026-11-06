"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountButton } from "./account";
import { NetworkPicker } from "./network-picker";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const noop = () => () => {};
export const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

const NAV = [
  { href: "/docs", label: "Docs" },
  { href: "/playground", label: "Playground" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden className="text-accent">
        <path d="M3 12c3-5 8-6 12-4l5-3-1.5 7L20 19l-5-3c-4 2-9 1-12-4Z" fill="currentColor" opacity=".18" />
        <path d="M3 12c3-5 8-6 12-4l5-3-1.5 7L20 19l-5-3c-4 2-9 1-12-4Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="8.5" cy="11" r="1" fill="currentColor" />
      </svg>
      <span>
        tiny<span className="text-accent">x402</span>
      </span>
    </Link>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-ink hover:bg-surface-2"
      aria-label="Toggle theme"
    >
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
      )}
    </button>
  );
}

export function Header() {
  const path = usePathname();
  return (
    <header
      className="sticky z-40 border-b border-line bg-bg/80 backdrop-blur"
      style={{ top: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 text-sm sm:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-md px-3 py-1.5 ${path.startsWith(n.href) ? "text-ink bg-surface-2" : "text-muted hover:text-ink"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <NetworkPicker className="relative hidden items-center md:inline-flex" />
          <ThemeToggle />
          <AccountButton />
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-4 pb-2 text-sm sm:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`rounded-md px-3 py-1 ${path.startsWith(n.href) ? "bg-surface-2 text-ink" : "text-muted"}`}>
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
