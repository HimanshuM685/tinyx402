export const DOCS_NAV: { title: string; items: { href: string; label: string }[] }[] = [
  {
    title: "Start here",
    items: [
      { href: "/docs", label: "Quick start" },
      { href: "/docs/authentication", label: "Authentication via x402" },
      { href: "/docs/for-coding-agents", label: "For coding agents" },
    ],
  },
  {
    title: "Guides",
    items: [
      { href: "/docs/how-x402-works", label: "How x402 payments work" },
      { href: "/docs/web-app", label: "Using the web app" },
      { href: "/docs/direct-api", label: "Using the API directly" },
      { href: "/docs/whitechain", label: "Whitechain + facilitator" },
    ],
  },
  {
    title: "API reference",
    items: [
      { href: "/docs/api/search", label: "Search" },
      { href: "/docs/api/fetch", label: "Fetch" },
      { href: "/docs/api/agent", label: "Agent run" },
      { href: "/docs/api/agent-sse", label: "Agent run (SSE)" },
      { href: "/docs/api/research", label: "Research" },
      { href: "/docs/api/browser", label: "Browser session" },
      { href: "/docs/errors", label: "Error codes" },
    ],
  },
];
