"use client";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { whitechainSepolia } from "./chains";

export const wagmiConfig = getDefaultConfig({
  appName: "tinyx402",
  // WalletConnect needs a real id from cloud.reown.com; injected wallets (MetaMask) work without it.
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "00000000000000000000000000000000",
  chains: [whitechainSepolia],
  transports: { [whitechainSepolia.id]: http() },
  ssr: true,
});

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "a", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;
