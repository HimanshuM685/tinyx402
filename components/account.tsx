"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth/client";

export type PlatformWallet = { user: { name: string; email: string; image?: string | null }; address: `0x${string}`; maxPerPayment: string };

/** Google-login platform wallet, or null when signed out / auth not configured. */
export function usePlatformWallet() {
  return useQuery({
    queryKey: ["platform-wallet"],
    queryFn: async (): Promise<PlatformWallet | null> => {
      const r = await fetch("/api/wallet");
      return r.ok ? r.json() : null;
    },
    staleTime: 60_000,
  });
}

export function GoogleButton({ compact = false }: { compact?: boolean }) {
  const { data, isLoading } = usePlatformWallet();
  const qc = useQueryClient();
  if (isLoading) return null;
  if (data)
    return (
      <span className="flex items-center gap-2 text-sm">
        {!compact && <span className="max-w-40 truncate text-muted" title={data.user.email}>{data.user.email}</span>}
        <button
          onClick={async () => {
            await authClient.signOut();
            qc.setQueryData(["platform-wallet"], null);
          }}
          className="rounded-md border border-line px-2.5 py-1 hover:bg-surface-2"
        >
          Sign out
        </button>
      </span>
    );
  return (
    <button
      onClick={() => authClient.signIn.social({ provider: "google", callbackURL: window.location.href })}
      className="rounded-md border border-line px-2.5 py-1 text-sm hover:bg-surface-2"
    >
      Sign in with Google
    </button>
  );
}
