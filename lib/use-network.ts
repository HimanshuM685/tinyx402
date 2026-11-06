"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isNetwork, type Network } from "./chains";

const KEY = ["network"];
const STORE = "tinyx402.network";

/**
 * The chain the user chose to pay on. Starts `null` on purpose — there is no default, so the
 * UI has to ask before it can send a paid request. Shared through react-query the same way
 * usePlatformWallet shares wallet state, so the header picker and the playground stay in sync.
 */
export function useNetwork() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: KEY,
    queryFn: (): Network | null => {
      try {
        const v = localStorage.getItem(STORE);
        return isNetwork(v) ? v : null;
      } catch {
        return null; // private window / blocked site data
      }
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  return {
    network: data ?? null,
    setNetwork: (n: Network) => {
      try {
        localStorage.setItem(STORE, n);
      } catch {}
      qc.setQueryData(KEY, n);
    },
  };
}
