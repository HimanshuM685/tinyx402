import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  serverExternalPackages: ["playwright-core", "linkedom", "shiki"],
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

const withMDX = createMDX({ options: { remarkPlugins: ["remark-gfm"] } });

export default withMDX(nextConfig);
