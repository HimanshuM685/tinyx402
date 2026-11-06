import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "tinyx402: web agents, paid per request", template: "%s · tinyx402" },
  description:
    "Search, Fetch, Browser Agent and Research APIs paid per request with USDT on Whitechain via the x402 protocol. No API keys.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} antialiased`} suppressHydrationWarning>
      <body className="min-h-dvh font-sans text-ink">
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
