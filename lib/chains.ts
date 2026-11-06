import type { Chain } from "viem";
import { arcTestnet, whitechainSepolia } from "viem/chains";

/**
 * Every chain fact lives here. Nothing else may name a chain, an asset or a facilitator.
 *
 * Both chains are advertised in the same 402 (`accepts` is an array), so a payer signs with
 * whichever asset they hold and the x402 SDK routes /settle to that chain's facilitator.
 * There is deliberately NO default network: the web app makes the user pick one, because
 * paying on the wrong chain is a mistake we would rather prevent than explain.
 */
export type Network = "eip155:1874" | "eip155:5042002";

export type ChainConfig = {
  chain: Chain;
  label: string;
  asset: {
    address: `0x${string}`;
    decimals: number;
    symbol: string;
    /** EIP-712 domain the payer signs under. One wrong character and the signature recovers to another address. */
    extra: { name: string; version: string };
  };
  /** Default facilitator; lib/x402.ts applies the env override (server-side only). */
  facilitatorUrl: string;
  /** How a payer gets the asset. */
  faucet: { label: string; url?: string; note: string };
  /** Native/gas token, for the "you don't need this" line in the UI. */
  gasNote: string;
};

export const CHAINS: Record<Network, ChainConfig> = {
  "eip155:1874": {
    // viem ships this chain; only the RPC/explorer are overridable, as before.
    chain: {
      ...whitechainSepolia,
      rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL || whitechainSepolia.rpcUrls.default.http[0]] } },
      blockExplorers: {
        default: {
          ...whitechainSepolia.blockExplorers!.default,
          url: process.env.NEXT_PUBLIC_EXPLORER_URL || whitechainSepolia.blockExplorers!.default.url,
        },
      },
    },
    label: "Whitechain Sepolia",
    asset: {
      address: (process.env.NEXT_PUBLIC_USDT_ADDRESS || "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7") as `0x${string}`,
      decimals: 6,
      symbol: "USDT",
      extra: { name: "Tether USD", version: "1" },
    },
    facilitatorUrl: "https://whitechain.007575.xyz",
    faucet: {
      label: "Ask for test USDT",
      note: "The test token's mint is owner-restricted, so it can't be self-minted. Ask the facilitator or token operator for an allocation.",
    },
    gasNote: "You don't need WBT — the facilitator pays the gas.",
  },
  "eip155:5042002": {
    chain: arcTestnet, // Circle L1. Native USDC reads 18 decimals; the ERC-20 view below is 6.
    label: "Arc Testnet",
    asset: {
      // Predeploy, same address on both Arc networks. Values match @x402/evm's
      // getDefaultAsset("eip155:5042002") — selftest asserts that so this can't drift.
      address: "0x3600000000000000000000000000000000000000",
      decimals: 6,
      symbol: "USDC",
      extra: { name: "USDC", version: "2" }, // version "2", not "1" — Circle's FiatToken signs with the ticker
    },
    facilitatorUrl: "https://arc.007575.xyz",
    faucet: {
      label: "Circle faucet",
      url: "https://faucet.circle.com",
      note: "Free test USDC. You need no second token — on Arc, gas is USDC too.",
    },
    gasNote: "Gas is USDC on Arc, and the facilitator pays it.",
  },
};

export const NETWORKS = Object.keys(CHAINS) as Network[];

export const isNetwork = (n: unknown): n is Network => typeof n === "string" && n in CHAINS;

/** Arc rejects anything under 0.01 USDC (`amount_below_minimum`); Whitechain has no floor. */
export const MIN_PAYMENT = BigInt(10_000);

export const explorerTx = (hash: string, network: Network) =>
  `${CHAINS[network].chain.blockExplorers!.default.url}/tx/${hash}`;

/** Base units -> display string. Needs the network: the asset and its decimals differ per chain. */
export const formatAmount = (base: string | bigint, network: Network) => {
  const { decimals } = CHAINS[network].asset;
  return (Number(base) / 10 ** decimals).toFixed(decimals).replace(/\.?0+$/, "");
};

/** `formatAmount` plus the ticker, e.g. "0.01 USDC". */
export const formatWithSymbol = (base: string | bigint, network: Network) =>
  `${formatAmount(base, network)} ${CHAINS[network].asset.symbol}`;

/** Reverse lookup for a signer that only has the EIP-712 domain's chainId. */
export const networkOfChainId = (id: unknown): Network | undefined =>
  NETWORKS.find((n) => CHAINS[n].chain.id === id);
