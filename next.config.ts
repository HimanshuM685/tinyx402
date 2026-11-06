import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  // /docs/whitechain predates the second chain and is linked from older pages and the account menu.
  redirects: () => [{ source: "/docs/whitechain", destination: "/docs/networks", permanent: true }],
  serverExternalPackages: ["playwright-core", "linkedom", "shiki"],
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

const withMDX = createMDX({ options: { remarkPlugins: ["remark-gfm"] } });

export default withMDX(nextConfig);
