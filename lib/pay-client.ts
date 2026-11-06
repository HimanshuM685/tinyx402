"use client";
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import type { WalletClient } from "viem";
import { NETWORK, USDT } from "./chains";

export type PayEvent =
  | { kind: "request"; url: string; method: string; paid: boolean }
  | { kind: "payment-required"; requirements: unknown }
  | { kind: "signing"; amount: string; payTo: string }
  | { kind: "signed" }
  | { kind: "response"; status: number; ms: number }
  | { kind: "settled"; transaction: string; payer?: string; network: string }
  | { kind: "error"; message: string };

export type Settlement = { transaction: string; payer?: string; network: string; success: boolean };

type TypedData = { domain: Record<string, unknown>; types: Record<string, unknown>; primaryType: string; message: Record<string, unknown> };
export type PaySigner = { address: `0x${string}`; sign: (m: TypedData) => Promise<`0x${string}`> };

/** Connected browser wallet (wagmi). */
export function walletSigner(wallet: WalletClient): PaySigner {
  const account = wallet.account!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { address: account.address, sign: (m) => wallet.signTypedData({ account, ...(m as any) }) };
}

/** Google-login platform wallet: the server signs (EIP-3009 to PAY_TO only, see lib/wallet.ts). */
export function platformSigner(address: `0x${string}`): PaySigner {
  return {
    address,
    async sign(m) {
      if (m.primaryType !== "TransferWithAuthorization") throw new Error("Platform wallet only signs EIP-3009 USDT payments");
      const { to, value, validAfter, validBefore, nonce } = m.message;
      const res = await fetch("/api/wallet/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, value: String(value), validAfter: String(validAfter), validBefore: String(validBefore), nonce }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.signature) throw new Error(out.error || `Platform wallet signing failed (HTTP ${res.status})`);
      return out.signature;
    },
  };
}

/**
 * Browser x402 client: signer -> EIP-3009 signature -> retried request.
 * The signer only signs typed data; the facilitator pays gas.
 */
export function createPaidFetch(payer: PaySigner, onEvent: (e: PayEvent) => void, maxAmountPerPayment = "250000") {
  const signer = {
    address: payer.address,
    async signTypedData(m: TypedData) {
      onEvent({ kind: "signing", amount: String(m.message.value ?? ""), payTo: String(m.message.to ?? "") });
      const sig = await payer.sign(m);
      onEvent({ kind: "signed" });
      return sig;
    },
  };

  const tracingFetch: typeof fetch = async (input, init) => {
    const req = new Request(input, init);
    const paid = req.headers.has("PAYMENT-SIGNATURE") || req.headers.has("X-PAYMENT");
    onEvent({ kind: "request", url: req.url, method: req.method, paid });
    const t = performance.now();
    const res = await fetch(req);
    onEvent({ kind: "response", status: res.status, ms: Math.round(performance.now() - t) });
    if (res.status === 402) {
      const h = res.headers.get("PAYMENT-REQUIRED");
      if (h) {
        try {
          onEvent({ kind: "payment-required", requirements: decodePaymentRequiredHeader(h) });
        } catch {}
      }
    }
    return res;
  };

  return wrapFetchWithPaymentFromConfig(tracingFetch, {
    schemes: [{ network: NETWORK, client: new ExactEvmScheme(signer) }],
    spendControls: {
      allowedAssets: [{ network: NETWORK, asset: USDT.address, maxAmountPerPayment }],
    },
  });
}

export function readSettlement(res: Response): Settlement | null {
  const h = res.headers.get("PAYMENT-RESPONSE") || res.headers.get("X-PAYMENT-RESPONSE");
  if (!h) return null;
  try {
    return decodePaymentResponseHeader(h) as Settlement;
  } catch {
    return null;
  }
}

// ---- local run history (dashboard) ----
export type LocalRun = {
  id: string;
  at: number;
  endpoint: string;
  amount: string;
  status: number;
  ms: number;
  payer?: string;
  tx?: string;
  input: unknown;
  output?: unknown;
};
const KEY = "tinyx402.runs.v1";

export function loadRuns(): LocalRun[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
export function saveRun(r: LocalRun) {
  try {
    const out = JSON.stringify(r.output ?? null);
    const slim = { ...r, output: out.length > 20_000 ? { truncated: true, preview: out.slice(0, 2000) } : r.output };
    localStorage.setItem(KEY, JSON.stringify([slim, ...loadRuns()].slice(0, 200)));
  } catch {}
}
export function clearRuns() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
