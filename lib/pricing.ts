// Single source of truth for prices. Base units at 6 decimals, identical on every chain —
// both supported assets are 6 decimals, so "10000" is 0.01 USDT or 0.01 USDC alike.
export const PRICES = {
  search: "10000", // 0.01
  fetch: "15000", // 0.015
  agent: "50000", // 0.05
  research: "200000", // 0.20 (mode "deep")
  browser: "30000", // 0.03
  datasets: "20000", // 0.02 per target row
} as const;

export const RESEARCH_MAX_PRICE = "500000"; // 0.50 (mode "max")
export const DATASET_MAX_ROWS = 250;
export const DATASET_DEFAULT_ROWS = 10;

export type Product = keyof typeof PRICES;

/** Price for a specific request. Server (dynamic x402 price) and playground both use this. */
export function quote(product: Product, body?: unknown): string {
  const b = (body ?? {}) as { mode?: string; target_rows?: number };
  if (product === "research" && b.mode === "max") return RESEARCH_MAX_PRICE;
  if (product === "datasets") {
    const rows = Math.min(Math.max(Math.trunc(Number(b.target_rows ?? DATASET_DEFAULT_ROWS)) || 1, 1), DATASET_MAX_ROWS);
    return String(BigInt(PRICES.datasets) * BigInt(rows));
  }
  return PRICES[product];
}

/** `path` is the chain-less suffix; compose a real URL with apiPath(network, path). */
export const ENDPOINTS: {
  id: string;
  product: Product;
  method: "GET" | "POST";
  path: string;
  title: string;
  description: string;
  priceNote?: string;
  stream?: boolean;
}[] = [
  { id: "search", product: "search", method: "GET", path: "/v1/search", title: "Search", description: "Structured web search results" },
  { id: "fetch", product: "fetch", method: "POST", path: "/v1/fetch", title: "Fetch", description: "Clean content extraction from up to 10 URLs" },
  { id: "agent", product: "agent", method: "POST", path: "/v1/agent/run", title: "Agent", description: "Goal-based browser automation" },
  { id: "agent-sse", product: "agent", method: "POST", path: "/v1/agent/run-sse", title: "Agent (SSE)", description: "Streaming agent run", stream: true },
  { id: "research", product: "research", method: "POST", path: "/v1/research", title: "Research", description: "Cited multi-source research report", priceNote: "0.50 for mode \"max\"" },
  { id: "datasets", product: "datasets", method: "POST", path: "/v1/datasets", title: "Datasets", description: "Structured dataset filled from the web", priceNote: "per target row" },
  { id: "browser", product: "browser", method: "POST", path: "/v1/browser", title: "Browser", description: "Remote browser session (CDP)" },
];
