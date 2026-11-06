import { z } from "zod";

export const SearchQuery = z.object({
  q: z.string().min(1).max(400).describe("Search query"),
  limit: z.coerce.number().int().min(1).max(20).default(10).describe("Max results (1-20)"),
});

export const FetchBody = z.object({
  urls: z.array(z.url()).min(1).max(10).describe("URLs to extract (max 10)"),
  format: z.enum(["markdown", "text", "html"]).default("markdown"),
  render: z.boolean().default(true).describe("Render with a real browser (JS). false = plain HTTP, faster"),
  links: z.boolean().default(false).describe("Include extracted links"),
});

export const AgentBody = z.object({
  url: z.url().describe("Start URL"),
  goal: z.string().min(3).max(4000).describe("Natural-language goal"),
  output_schema: z.record(z.string(), z.unknown()).optional().describe("JSON Schema for the result"),
  max_steps: z.number().int().min(1).max(40).default(20),
});

export const ResearchBody = z.object({
  query: z.string().min(3).max(2000),
  depth: z.enum(["quick", "standard", "deep"]).default("standard"),
});

export const BrowserBody = z.object({
  timeout_seconds: z.number().int().min(30).max(1800).default(300).describe("Session lifetime"),
});

export function issues(e: z.ZodError) {
  return e.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}
