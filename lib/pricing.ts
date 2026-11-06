// Single source of truth for prices (USDT base units, 6 decimals).
export const PRICES = {
  search: "10000",
  fetch: "15000",
  agent: "50000",
  research: "200000",
  browser: "30000",
} as const;

export type Product = keyof typeof PRICES;

export const ENDPOINTS: {
  id: string;
  product: Product;
  method: "GET" | "POST";
  path: string;
  title: string;
  description: string;
  stream?: boolean;
}[] = [
  { id: "search", product: "search", method: "GET", path: "/api/v1/search", title: "Search", description: "Structured web search results" },
  { id: "fetch", product: "fetch", method: "POST", path: "/api/v1/fetch", title: "Fetch", description: "Clean content extraction from URL(s)" },
  { id: "agent", product: "agent", method: "POST", path: "/api/v1/agent/run", title: "Agent", description: "Goal-based browser automation" },
  { id: "agent-sse", product: "agent", method: "POST", path: "/api/v1/agent/run-sse", title: "Agent (SSE)", description: "Streaming agent run", stream: true },
  { id: "research", product: "research", method: "POST", path: "/api/v1/research", title: "Research", description: "Multi-source research report" },
  { id: "browser", product: "browser", method: "POST", path: "/api/v1/browser", title: "Browser", description: "Create remote browser session (CDP)" },
];
