import { z } from "zod";
import { DATASET_DEFAULT_ROWS, DATASET_MAX_ROWS } from "./pricing";

// z.object strips unknown keys, so account-scoped TinyFish options (vault, profiles,
// prior research runs) can never be forwarded on the operator's key.

const purpose = z.string().min(1).max(2000).optional().describe("Why you are searching/fetching; improves results");
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const boolStr = z.enum(["true", "false"]);

export const SearchQuery = z.object({
  query: z.string().min(1).max(2000).describe("Search query"),
  purpose,
  location: z.string().length(2).optional().describe("Country code, e.g. US"),
  language: z.string().min(2).max(10).optional().describe("Language code, e.g. en"),
  include_domains: z.string().max(2000).optional().describe("Comma-separated domains to restrict to"),
  exclude_domains: z.string().max(2000).optional().describe("Comma-separated domains to exclude"),
  domain_type: z.enum(["web", "news", "research_paper"]).optional(),
  after_date: ymd.optional(),
  before_date: ymd.optional(),
  recency_minutes: z.coerce.number().int().min(1).max(5_256_000).optional(),
  pub_year_min: z.coerce.number().int().min(0).max(9999).optional(),
  pub_year_max: z.coerce.number().int().min(0).max(9999).optional(),
  page: z.coerce.number().int().min(0).max(10).optional(),
  include_thumbnail: boolStr.optional(),
}).refine((q) => !(q.recency_minutes && (q.after_date || q.before_date)), "Do not combine recency_minutes with after_date/before_date");

export const FetchBody = z.object({
  urls: z.array(z.url()).min(1).max(10).describe("1-10 URLs"),
  format: z.enum(["markdown", "html", "json"]).default("markdown"),
  purpose,
  links: z.boolean().optional(),
  image_links: z.boolean().optional(),
  iframe_links: z.boolean().optional(),
  page_metadata: z.boolean().optional(),
  ttl: z.number().int().min(0).optional().describe("Cache freshness tolerance in seconds; 0 = live"),
  per_url_timeout_ms: z.number().int().min(1).max(110_000).optional(),
  if_none_match: z.string().min(1).optional(),
  if_modified_since: z.string().min(1).optional(),
  include_etag_and_last_modified: z.boolean().optional(),
  include_selectors: z.array(z.string().min(1).max(1000)).min(1).max(20).optional(),
  exclude_selectors: z.array(z.string().min(1).max(1000)).min(1).max(20).optional(),
});

export const AgentBody = z.object({
  url: z.string().min(1).max(2000).describe("Start URL"),
  goal: z.string().min(1).max(10_000).describe("Natural-language goal"),
  browser_profile: z.enum(["lite", "stealth"]).optional(),
  agent_config: z
    .object({
      mode: z.enum(["default", "strict"]).optional(),
      max_steps: z.number().int().min(1).max(500).optional(),
      max_duration_seconds: z.number().int().min(1).max(780).optional(),
    })
    .optional(),
  proxy_config: z.object({ enabled: z.boolean(), country_code: z.string().length(2).optional() }).optional(),
  output_schema: z.record(z.string(), z.unknown()).optional().describe("JSON Schema for the result"),
});

export const ResearchBody = z.object({
  query: z.string().min(1).max(2000),
  mode: z.enum(["deep", "max"]).default("deep"),
  output_language: z.string().min(2).max(35).optional().describe("BCP 47 tag, e.g. en"),
  stream: z.boolean().optional().describe("Emit report text as synthesis_delta events"),
  weak_sources_enabled: z.boolean().optional(),
  domain_type: z.enum(["web", "news", "research_paper"]).optional(),
  after_date: ymd.optional(),
  before_date: ymd.optional(),
  recency_minutes: z.number().int().min(1).max(5_256_000).optional(),
  domain_filter: z
    .object({
      mode: z.enum(["include", "exclusive"]),
      domains: z.array(z.string()).max(150).optional(),
      block: z.array(z.string()).max(150).optional(),
    })
    .optional(),
});

export const DatasetBody = z
  .object({
    prompt: z.string().min(3).max(15_000).optional().describe("What the dataset should contain"),
    spec: z
      .object({
        name: z.string().min(1).max(200),
        description: z.string(),
        columns: z.array(z.record(z.string(), z.unknown())).min(1).max(64),
        keep_when: z.record(z.string(), z.unknown()).optional(),
      })
      .optional(),
    target_rows: z.number().int().min(1).max(DATASET_MAX_ROWS).default(DATASET_DEFAULT_ROWS),
  })
  .refine((b) => b.prompt || b.spec, "Provide prompt or spec");

export const BrowserBody = z.object({
  url: z.string().max(2000).optional().describe("Navigate here on startup"),
  timeout_seconds: z.number().int().min(5).max(3600).optional().describe("Inactivity timeout"),
  proxy_config: z
    .object({
      enabled: z.boolean().optional(),
      type: z.enum(["tinyfish", "custom"]).optional(),
      country_code: z.string().length(2).optional(),
      url: z.string().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
    })
    .optional(),
});

export function issues(e: z.ZodError) {
  return e.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}
