"use client";
import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "next-themes";
import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { useMounted } from "./header";

function Rainbow({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  // First client render must match SSR (light), or React keeps the server <style> after hydration.
  const dark = useMounted() && resolvedTheme === "dark";
  const opts = { accentColor: dark ? "#3ad0a4" : "#0b7a62", borderRadius: "medium" as const };
  return (
    <RainbowKitProvider
      theme={dark ? darkTheme({ ...opts, accentColorForeground: "#04140f" }) : lightTheme(opts)}
      modalSize="compact"
    >
      {children}
    </RainbowKitProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient());
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={qc}>
          <Rainbow>{children}</Rainbow>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
