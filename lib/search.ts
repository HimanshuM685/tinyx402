import "server-only";
import { parseHTML } from "linkedom";

export type SearchResult = { position: number; title: string; url: string; snippet: string; source: string };

export async function search(q: string, limit = 10): Promise<{ provider: string; results: SearchResult[] }> {
  if (process.env.BRAVE_API_KEY) return { provider: "brave", results: await brave(q, limit) };
  if (process.env.TAVILY_API_KEY) return { provider: "tavily", results: await tavily(q, limit) };
  return { provider: "duckduckgo", results: await ddg(q, limit) };
}

export function normalize(items: { title?: string; url?: string; snippet?: string }[], limit: number): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const i of items) {
    if (!i.url || !/^https?:\/\//.test(i.url) || seen.has(i.url)) continue;
    seen.add(i.url);
    out.push({
      position: out.length + 1,
      title: (i.title || "").replace(/<[^>]+>/g, "").trim(),
      url: i.url,
      snippet: (i.snippet || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
      source: new URL(i.url).hostname.replace(/^www\./, ""),
    });
    if (out.length >= limit) break;
  }
  return out;
}

async function brave(q: string, limit: number) {
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=${Math.min(limit, 20)}`,
    { headers: { "X-Subscription-Token": process.env.BRAVE_API_KEY!, Accept: "application/json" }, signal: AbortSignal.timeout(15_000) },
  );
  if (!res.ok) throw new Error(`Brave search failed: HTTP ${res.status}`);
  const j = (await res.json()) as { web?: { results?: { title: string; url: string; description: string }[] } };
  return normalize((j.web?.results || []).map((r) => ({ title: r.title, url: r.url, snippet: r.description })), limit);
}

async function tavily(q: string, limit: number) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
    body: JSON.stringify({ query: q, max_results: Math.min(limit, 20) }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Tavily search failed: HTTP ${res.status}`);
  const j = (await res.json()) as { results?: { title: string; url: string; content: string }[] };
  return normalize((j.results || []).map((r) => ({ title: r.title, url: r.url, snippet: r.content })), limit);
}

// ponytail: HTML scrape fallback, brittle by nature; set BRAVE_API_KEY or TAVILY_API_KEY in production.
async function ddg(q: string, limit: number) {
  const res = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0 (compatible; tinyx402/1.0)" },
    body: new URLSearchParams({ q }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`DuckDuckGo search failed: HTTP ${res.status}`);
  return parseDdg(await res.text(), limit);
}

export function parseDdg(html: string, limit: number) {
  const { document } = parseHTML(html);
  const items = [...document.querySelectorAll(".result")].map((r) => {
    const a = r.querySelector("a.result__a");
    let href = a?.getAttribute("href") || "";
    const m = href.match(/[?&]uddg=([^&]+)/);
    if (m) href = decodeURIComponent(m[1]);
    if (href.startsWith("//")) href = "https:" + href;
    return { title: a?.textContent || "", url: href, snippet: r.querySelector(".result__snippet")?.textContent || "" };
  });
  return normalize(items.filter((i) => !i.url.includes("duckduckgo.com/y.js")), limit);
}
