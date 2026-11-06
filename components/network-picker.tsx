"use client";
import { CHAINS, NETWORKS, type Network } from "@/lib/chains";
import { useNetwork } from "@/lib/use-network";

/**
 * Chain chooser. Every 402 offers both chains, so this is the user's pick of which one to pay
 * on — there is no default, and an unset state reads "Choose network" rather than quietly
 * selecting one for them.
 */
export function NetworkPicker({ className }: { className?: string }) {
  const { network, setNetwork } = useNetwork();
  return (
    <label className={className ?? "relative inline-flex items-center"}>
      <span className="sr-only">Payment network</span>
      <select
        value={network ?? ""}
        onChange={(e) => setNetwork(e.target.value as Network)}
        className={`cursor-pointer appearance-none rounded-full border py-1 pl-2.5 pr-7 font-mono text-[11px] ${
          network ? "border-line bg-transparent text-muted" : "border-accent bg-accent/10 text-accent"
        }`}
      >
        <option value="" disabled>
          Choose network
        </option>
        {NETWORKS.map((n) => (
          <option key={n} value={n}>
            {CHAINS[n].asset.symbol} · {CHAINS[n].label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2 opacity-60"
        width="9"
        height="9"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        aria-hidden
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </label>
  );
}
