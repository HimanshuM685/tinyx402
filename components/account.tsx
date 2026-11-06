"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useReadContract } from "wagmi";
import { ConnectButton, useConnectModal } from "@rainbow-me/rainbowkit";
import { authClient } from "@/lib/auth/client";
import { USDT, whitechainSepolia, formatUsdt } from "@/lib/chains";
import { erc20Abi } from "@/lib/wagmi";
import { CopyButton } from "./copy-button";

export type PlatformWallet = { user: { name: string; email: string; image?: string | null }; address: `0x${string}`; maxPerPayment: string };
type WalletState = { wallet: PlatformWallet | null; authEnabled: boolean };

/**
 * Google-login platform wallet. The first fetch after sign-in creates the wallet server-side
 * (saved in the `wallets` table), so returning from Google is all it takes.
 */
export function usePlatformWallet() {
  const q = useQuery({
    queryKey: ["platform-wallet"],
    queryFn: async (): Promise<WalletState> => {
      const r = await fetch("/api/wallet");
      if (r.ok) return { wallet: await r.json(), authEnabled: true };
      return { wallet: null, authEnabled: r.status !== 503 };
    },
    staleTime: Infinity, // changes only on sign-in/out, which update the cache directly
    refetchOnWindowFocus: false,
  });
  return { ...q, data: q.data?.wallet ?? null, authEnabled: q.data?.authEnabled ?? false };
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Header entry point: "Get started" → chooser; then a Google account chip or the wallet button. */
export function AccountButton() {
  const { data: platform, isLoading } = usePlatformWallet();
  const { isConnected } = useAccount();
  if (isLoading) return <span className="h-9 w-28 animate-pulse rounded-lg bg-surface-2" aria-hidden />;
  if (platform) return <AccountChip w={platform} />;
  if (isConnected) return <ConnectButton chainStatus="icon" showBalance={false} accountStatus={{ smallScreen: "avatar", largeScreen: "address" }} />;
  return <GetStarted />;
}

export function GetStarted({ label = "Get started", className }: { label?: string; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { authEnabled } = usePlatformWallet();
  const { openConnectModal } = useConnectModal();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function google() {
    setPending(true);
    setError("");
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: window.location.href });
    if (error) {
      setError(error.message || "Google sign-in failed");
      setPending(false);
    } // success navigates away to Google
  }

  return (
    <>
      <button
        onClick={() => {
          ref.current?.showModal();
          ref.current?.querySelector<HTMLButtonElement>("[data-primary], [data-wallet]")?.focus(); // not the close button
        }}
        className={className ?? "rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink hover:opacity-90"}
      >
        {label}
      </button>
      <dialog
        ref={ref}
        onClick={(e) => e.target === ref.current && ref.current.close()} // backdrop click
        className="m-auto w-[calc(100%-32px)] max-w-sm rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Get started</h2>
              <p className="mt-1 text-sm text-muted">Pay for web APIs per request in test USDT.</p>
            </div>
            <button onClick={() => ref.current?.close()} aria-label="Close" className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {authEnabled && (
              <button
                data-primary
                onClick={google}
                disabled={pending}
                className="flex items-center justify-center gap-3 rounded-xl border border-line bg-bg px-4 py-3 text-sm font-medium hover:bg-surface-2 disabled:opacity-60"
              >
                <GoogleIcon />
                {pending ? "Redirecting to Google…" : "Continue with Google"}
              </button>
            )}
            <button
              data-wallet
              onClick={() => {
                ref.current?.close();
                openConnectModal?.();
              }}
              className="flex items-center justify-center gap-3 rounded-xl border border-line bg-bg px-4 py-3 text-sm font-medium hover:bg-surface-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 14.5h2" /></svg>
              Connect a wallet
            </button>
          </div>

          {error && <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

          <ul className="mt-5 space-y-1.5 border-t border-line pt-4 text-xs text-muted">
            {authEnabled && <li><span className="text-ink">Google</span> creates a wallet for you. No extension, no pop-ups when you pay.</li>}
            <li><span className="text-ink">Wallet</span>: MetaMask, Rabby, Brave, Coinbase or any browser wallet.</li>
            <li>
              Agents and scripts need neither. Call the API with x402 directly. <Link href="/docs/authentication" className="text-accent hover:underline" onClick={() => ref.current?.close()}>How</Link>
            </li>
          </ul>
        </div>
      </dialog>
    </>
  );
}

function AccountChip({ w }: { w: PlatformWallet }) {
  const qc = useQueryClient();
  const bal = useReadContract({ address: USDT.address, abi: erc20Abi, functionName: "balanceOf", args: [w.address], chainId: whitechainSepolia.id });
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-sm hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <Avatar w={w} />
        <span className="hidden font-mono text-xs sm:inline">{short(w.address)}</span>
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-line bg-surface p-4 text-sm shadow-xl">
        <p className="truncate font-medium">{w.user.name}</p>
        <p className="truncate text-xs text-muted">{w.user.email}</p>
        <div className="mt-3 rounded-lg bg-surface-2 p-3">
          <p className="text-xs text-muted">Your wallet · Whitechain Sepolia</p>
          <p className="mt-1 flex items-center justify-between gap-2 font-mono text-xs">
            {short(w.address)} <CopyButton text={w.address} />
          </p>
          <p className="mt-2 font-mono">{bal.data === undefined ? "–" : formatUsdt(bal.data as bigint)} USDT</p>
        </div>
        <Link href="/docs/whitechain#getting-test-funds" className="mt-3 block text-xs text-accent hover:underline">
          Get test USDT
        </Link>
        <button
          onClick={async () => {
            await authClient.signOut();
            qc.setQueryData(["platform-wallet"], { wallet: null, authEnabled: true });
          }}
          className="mt-3 w-full rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface-2"
        >
          Sign out
        </button>
      </div>
    </details>
  );
}

function Avatar({ w }: { w: PlatformWallet }) {
  // eslint-disable-next-line @next/next/no-img-element -- remote Google avatar, tiny, no optimizer config needed
  if (w.user.image) return <img src={w.user.image} alt="" className="size-6 rounded-full" referrerPolicy="no-referrer" />;
  return <span className="grid size-6 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-ink">{(w.user.name || w.user.email)[0]?.toUpperCase()}</span>;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
