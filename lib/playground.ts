// Playground form model: field specs per endpoint and form -> request mapping.
// Kept out of the component so scripts/selftest.ts can exercise it.
import type { z } from "zod";
import { ENDPOINTS } from "./pricing";
import { SearchQuery, FetchBody, AgentBody, ResearchBody, DatasetBody, BrowserBody } from "./schemas";

export type Id = (typeof ENDPOINTS)[number]["id"];
export type Value = string | boolean;
export type Form = Record<string, Value>;

/**
 * Declarative form per endpoint. `key` is a dot path into the request (query params for GET).
 * kind: text | area | number | select | check | list (newline/comma separated -> string[]) | json.
 * `local` fields steer the playground and are never sent.
 */
export type FieldSpec = {
  key: string;
  label: string;
  kind: "text" | "area" | "number" | "select" | "check" | "list" | "json";
  options?: string[];
  hint?: string;
  placeholder?: string;
  advanced?: boolean;
  local?: boolean;
  checkedValue?: unknown; // value sent when a checkbox is ticked (default true)
  half?: boolean; // render two per row
};

export const FIELDS: Record<Id, FieldSpec[]> = {
  search: [
    { key: "query", label: "Query", kind: "text" },
    { key: "domain_type", label: "Domain type", kind: "select", options: ["web", "news", "research_paper"], half: true },
    { key: "location", label: "Country", kind: "text", placeholder: "US", half: true },
    { key: "purpose", label: "Purpose", kind: "text", placeholder: "Why you are searching (improves ranking)" },
    { key: "language", label: "Language", kind: "text", placeholder: "en", advanced: true, half: true },
    { key: "page", label: "Page (0-10)", kind: "number", placeholder: "0", advanced: true, half: true },
    { key: "include_domains", label: "Include domains", kind: "text", placeholder: "github.com,arxiv.org", advanced: true },
    { key: "exclude_domains", label: "Exclude domains", kind: "text", placeholder: "pinterest.com", advanced: true },
    { key: "recency_minutes", label: "Recency (minutes)", kind: "number", hint: "Don't combine with dates", advanced: true },
    { key: "after_date", label: "After", kind: "text", placeholder: "YYYY-MM-DD", advanced: true, half: true },
    { key: "before_date", label: "Before", kind: "text", placeholder: "YYYY-MM-DD", advanced: true, half: true },
    { key: "pub_year_min", label: "Pub. year min", kind: "number", hint: "research_paper only", advanced: true, half: true },
    { key: "pub_year_max", label: "Pub. year max", kind: "number", advanced: true, half: true },
    { key: "include_thumbnail", label: "Include thumbnails", kind: "check", checkedValue: "true", advanced: true },
  ],
  fetch: [
    { key: "urls", label: "URLs", kind: "list", hint: "One per line, up to 10. One payment covers all." },
    { key: "format", label: "Format", kind: "select", options: ["markdown", "html", "json"], half: true },
    { key: "ttl", label: "Cache TTL (s)", kind: "number", placeholder: "any", hint: "0 = live fetch", half: true },
    { key: "purpose", label: "Purpose", kind: "text", placeholder: "What the content is for" },
    { key: "include_selectors", label: "Include selectors", kind: "list", placeholder: "article", hint: "CSS, one per line", advanced: true },
    { key: "exclude_selectors", label: "Exclude selectors", kind: "list", placeholder: ".comments", advanced: true },
    { key: "per_url_timeout_ms", label: "Per-URL timeout (ms)", kind: "number", placeholder: "max 110000", advanced: true },
    { key: "links", label: "Outbound links", kind: "check", advanced: true },
    { key: "image_links", label: "Image links", kind: "check", advanced: true },
    { key: "iframe_links", label: "Iframe links", kind: "check", advanced: true },
    { key: "page_metadata", label: "Page metadata (OG, canonical…)", kind: "check", advanced: true },
  ],
  agent: [],
  "agent-sse": [],
  research: [
    { key: "query", label: "Question", kind: "area" },
    { key: "mode", label: "Mode", kind: "select", options: ["deep", "max"], hint: "deep 5-20 min · max 5-45 min, costs more", half: true },
    { key: "output_language", label: "Report language", kind: "text", placeholder: "en", half: true },
    { key: "domain_type", label: "Domain type", kind: "select", options: ["", "web", "news", "research_paper"], advanced: true },
    { key: "recency_minutes", label: "Recency (minutes)", kind: "number", advanced: true },
    { key: "after_date", label: "After", kind: "text", placeholder: "YYYY-MM-DD", advanced: true, half: true },
    { key: "before_date", label: "Before", kind: "text", placeholder: "YYYY-MM-DD", advanced: true, half: true },
    { key: "domain_filter.mode", label: "Domain filter", kind: "select", options: ["", "include", "exclusive"], hint: "include = prefer · exclusive = only", advanced: true },
    { key: "domain_filter.domains", label: "Filter domains", kind: "list", placeholder: "nature.com", advanced: true },
    { key: "domain_filter.block", label: "Blocked domains", kind: "list", placeholder: "reddit.com", advanced: true },
    { key: "weak_sources_enabled", label: "Allow social / community sources", kind: "check", advanced: true },
    { key: "stream", label: "Stream report text (synthesis_delta)", kind: "check", advanced: true },
    { key: "follow", label: "Follow progress after paying", kind: "check", local: true },
  ],
  datasets: [
    { key: "prompt", label: "Describe the dataset", kind: "area" },
    { key: "target_rows", label: "Target rows", kind: "number", hint: "1-250 · priced per row" },
    { key: "spec", label: "Explicit spec (JSON, replaces prompt)", kind: "json", placeholder: '{"name":"…","description":"…","columns":[{"name":"shop_name","type":"string","is_primary_key":true}]}', advanced: true },
    { key: "follow", label: "Follow the fill, then load rows", kind: "check", local: true },
  ],
  browser: [
    { key: "url", label: "Start URL", kind: "text", placeholder: "optional" },
    { key: "timeout_seconds", label: "Idle timeout (s)", kind: "number", placeholder: "plan max", half: true },
    { key: "proxy_config.country_code", label: "Proxy country", kind: "text", placeholder: "US", half: true },
    { key: "proxy_config.enabled", label: "Direct egress (no proxy)", kind: "check", checkedValue: false, advanced: true },
    { key: "proxy_config.type", label: "Proxy type", kind: "select", options: ["", "tinyfish", "custom"], advanced: true },
    { key: "proxy_config.url", label: "Custom proxy URL", kind: "text", placeholder: "http://host:port", advanced: true },
    { key: "proxy_config.username", label: "Proxy username", kind: "text", advanced: true, half: true },
    { key: "proxy_config.password", label: "Proxy password", kind: "text", advanced: true, half: true },
  ],
};
FIELDS.agent = [
  { key: "url", label: "Start URL", kind: "text" },
  { key: "goal", label: "Goal", kind: "area", hint: "Say what to do and what to return" },
  { key: "output_schema", label: "Output schema (JSON Schema)", kind: "json", placeholder: '{"type":"object","properties":{"stories":{"type":"array"}}}' },
  { key: "browser_profile", label: "Browser", kind: "select", options: ["lite", "stealth"], hint: "stealth = anti-bot", half: true },
  { key: "agent_config.max_steps", label: "Max steps", kind: "number", placeholder: "150", half: true },
  { key: "agent_config.mode", label: "Mode", kind: "select", options: ["", "default", "strict"], hint: "strict fails fast", advanced: true, half: true },
  { key: "agent_config.max_duration_seconds", label: "Max duration (s)", kind: "number", placeholder: "280", advanced: true, half: true },
  { key: "proxy_config.country_code", label: "Proxy country", kind: "text", placeholder: "US", advanced: true },
];
FIELDS["agent-sse"] = FIELDS.agent;

export const DEFAULTS: Record<Id, Form> = {
  search: { query: "x402 payment protocol", domain_type: "web" },
  fetch: { urls: "https://www.tinyfish.ai/", format: "markdown" },
  agent: { url: "https://news.ycombinator.com", goal: "Return the title and URL of the top 5 stories.", browser_profile: "lite", "agent_config.max_steps": "30" },
  "agent-sse": { url: "https://news.ycombinator.com", goal: "Return the title and URL of the top 5 stories.", browser_profile: "lite", "agent_config.max_steps": "30" },
  research: { query: "How does the x402 payment protocol work and who is adopting it?", mode: "deep", follow: true },
  datasets: { prompt: "Specialty coffee shops in Oakland with their website and rating", target_rows: "10", follow: true },
  browser: { url: "https://www.tinyfish.ai", timeout_seconds: "300" },
};

export const NOTES: Partial<Record<Id, string>> = {
  agent: "Waits for the result (runs are capped at 280 s). Not charged if the run fails.",
  "agent-sse": "Streams steps and a live browser view. Settles only on COMPLETED.",
  research: "Starts a background run and settles when accepted. Progress streams for free afterwards.",
  datasets: "Plans columns (up to 1 min), then fills in the background. Settles when created.",
  browser: "Session creation takes 10-30 s. End it early from the response's end_url.",
};

const SCHEMAS: Record<Id, z.ZodType> = {
  search: SearchQuery, fetch: FetchBody, agent: AgentBody, "agent-sse": AgentBody,
  research: ResearchBody, datasets: DatasetBody, browser: BrowserBody,
};

function setPath(obj: Record<string, unknown>, path: string, v: unknown) {
  const keys = path.split(".");
  let o = obj;
  for (const k of keys.slice(0, -1)) o = (o[k] ??= {}) as Record<string, unknown>;
  o[keys.at(-1)!] = v;
}

/** Form -> request body. Empty fields are omitted; validated with the server's own zod schema. */
/** `url` is the chain-less suffix; the caller composes it with apiPath(network, url). */
export function buildRequest(id: Id, f: Form): { url: string; init: RequestInit; body: Record<string, unknown> } | { error: string } {
  const ep = ENDPOINTS.find((e) => e.id === id)!;
  const body: Record<string, unknown> = {};
  for (const fs of FIELDS[id]) {
    if (fs.local) continue;
    const raw = f[fs.key];
    if (fs.kind === "check") {
      if (raw) setPath(body, fs.key, fs.checkedValue ?? true);
      continue;
    }
    const v = typeof raw === "string" ? raw.trim() : "";
    if (!v) continue;
    if (fs.kind === "number") {
      if (!/^-?\d+$/.test(v)) return { error: `${fs.label} must be a whole number` };
      setPath(body, fs.key, Number(v));
    } else if (fs.kind === "list") {
      setPath(body, fs.key, v.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean));
    } else if (fs.kind === "json") {
      try {
        setPath(body, fs.key, JSON.parse(v));
      } catch {
        return { error: `${fs.label} is not valid JSON` };
      }
    } else setPath(body, fs.key, fs.key.endsWith("country_code") || fs.key === "location" ? v.toUpperCase() : v);
  }
  // TinyFish needs proxy_config.enabled when a proxy object is sent for an agent run.
  const proxy = body.proxy_config as Record<string, unknown> | undefined;
  if (proxy && proxy.enabled === undefined && (id === "agent" || id === "agent-sse")) proxy.enabled = true;
  if (id === "datasets" && body.spec) delete body.prompt;

  const check = SCHEMAS[id].safeParse(body);
  if (!check.success) {
    const i = check.error.issues[0];
    return { error: `${i.path.join(".") || "request"}: ${i.message}` };
  }
  if (ep.method === "GET") {
    const qs = new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)]));
    return { url: `${ep.path}?${qs}`, init: { method: "GET" }, body };
  }
  return { url: ep.path, body, init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } };
}
