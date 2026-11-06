import type { Metadata } from "next";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted">Recent runs and payments, from PAYMENT-RESPONSE receipts.</p>
      <Dashboard />
    </main>
  );
}
