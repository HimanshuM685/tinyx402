import { defineChain } from "viem";

// Client-safe network constants. Add mainnet (eip155:1875) here later.
export const whitechainSepolia = defineChain({
  id: 1874,
  name: "Whitechain Sepolia",
  nativeCurrency: { name: "WBT", symbol: "WBT", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.testnet.whitechain.io"] },
  },
  blockExplorers: {
    default: {
      name: "Whitechain Explorer",
      url: process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.testnet.whitechain.io",
    },
  },
  testnet: true,
});

export const NETWORK = "eip155:1874" as const;
export const USDT = {
  address: (process.env.NEXT_PUBLIC_USDT_ADDRESS ||
    "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7") as `0x${string}`,
  decimals: 6,
  symbol: "USDT",
  extra: { name: "Tether USD", version: "1" },
};
export const FACILITATOR_URL = "https://whitechain.007575.xyz";

export const explorerTx = (hash: string) =>
  `${whitechainSepolia.blockExplorers.default.url}/tx/${hash}`;
export const explorerAddress = (a: string) =>
  `${whitechainSepolia.blockExplorers.default.url}/address/${a}`;

export const formatUsdt = (base: string | bigint) =>
  (Number(base) / 10 ** USDT.decimals).toFixed(USDT.decimals).replace(/\.?0+$/, "");
