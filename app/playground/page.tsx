import type { Metadata } from "next";
import Link from "next/link";
import { Playground } from "./playground";

export const metadata: Metadata = { title: "Playground" };

export default function Page() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Playground</h1>
          <p className="mt-1 text-sm text-muted">
            Real requests, real payments. Pick a chain, your wallet signs, and the facilitator pays the gas.
          </p>
        </div>
        <Link href="/docs/web-app" className="text-sm text-accent hover:underline">
          Need test funds?
        </Link>
      </div>
      <Playground />
    </main>
  );
}
