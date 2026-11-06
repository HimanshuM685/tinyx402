"use client";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { braveWallet, coinbaseWallet, injectedWallet, rabbyWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { whitechainSepolia } from "./chains";

// Browser wallets only, no WalletConnect, so no Reown project ID is needed.
// Installed extensions (MetaMask, Rabby, OKX…) also appear automatically via EIP-6963.
const connectors = connectorsForWallets(
  [{ groupName: "Browser wallets", wallets: [injectedWallet, rabbyWallet, braveWallet, coinbaseWallet] }],
  { appName: "tinyx402", projectId: "unused" }, // only read by WalletConnect-based wallets, none listed
);

export const wagmiConfig = createConfig({
  chains: [whitechainSepolia],
  connectors,
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
