import "server-only";
import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import { withPage } from "./browser";
import { assertPublicUrl } from "./safe-url";

export type Extracted = {
  url: string;
  final_url: string;
  title: string;
  byline?: string | null;
  excerpt?: string | null;
  content: string;
  format: "markdown" | "text" | "html";
  word_count: number;
  links?: { text: string; href: string }[];
};

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
turndown.remove(["script", "style", "noscript", "iframe"]);

export function htmlToContent(
  html: string,
  url: string,
  format: Extracted["format"] = "markdown",
  withLinks = false,
): Omit<Extracted, "url" | "final_url"> {
  const { document } = parseHTML(html);
  const links = withLinks
    ? [...document.querySelectorAll("a[href]")]
        .map((a) => ({ text: (a.textContent || "").trim().slice(0, 120), href: safeHref(a.getAttribute("href"), url) }))
        .filter((l): l is { text: string; href: string } => !!l.href && !!l.text)
        .slice(0, 200)
    : undefined;
  const article = new Readability(document as unknown as Document, { charThreshold: 200 }).parse();
  const bodyHtml = article?.content || document.body?.innerHTML || "";
  const text = article?.textContent?.trim() || document.body?.textContent?.trim() || "";
  const content =
    format === "html" ? bodyHtml : format === "text" ? text.replace(/\n{3,}/g, "\n\n") : turndown.turndown(bodyHtml);
  return {
    title: article?.title || document.title || "",
    byline: article?.byline,
    excerpt: article?.excerpt,
    content,
    format,
    word_count: text.split(/\s+/).filter(Boolean).length,
    links,
  };
}

function safeHref(href: string | null, base: string) {
  if (!href) return null;
  try {
    const u = new URL(href, base);
    return u.protocol.startsWith("http") ? u.href : null;
  } catch {
    return null;
  }
}

const MAX_BYTES = 5_000_000;

/** Plain HTTP fetch, no JS. Fast path; used by research and `render: false`. */
export async function fetchStatic(raw: string, format: Extracted["format"] = "markdown", withLinks = false): Promise<Extracted> {
  let url = await assertPublicUrl(raw);
  let res: Response | null = null;
  for (let hop = 0; hop < 5; hop++) {
    res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 tinyx402/1.0", Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
      signal: AbortSignal.timeout(15_000),
    });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      url = await assertPublicUrl(new URL(loc, url).href); // re-check each redirect hop
      continue;
    }
    break;
  }
  if (!res || !res.ok) throw new Error(`HTTP ${res?.status} fetching ${raw}`);
  const len = Number(res.headers.get("content-length") || 0);
  if (len > MAX_BYTES) throw new Error(`Page too large (${len} bytes)`);
  const html = (await res.text()).slice(0, MAX_BYTES);
  return { url: raw, final_url: url.href, ...htmlToContent(html, url.href, format, withLinks) };
}

/** Full browser render, for JS-heavy pages. */
export async function fetchRendered(raw: string, format: Extracted["format"] = "markdown", withLinks = false): Promise<Extracted> {
  await assertPublicUrl(raw);
  return withPage(async (ctx) => {
    const page = await ctx.newPage();
    const res = await page.goto(raw, { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (res && res.status() >= 400) throw new Error(`HTTP ${res.status()} fetching ${raw}`);
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    const html = await page.content();
    return { url: raw, final_url: page.url(), ...htmlToContent(html, page.url(), format, withLinks) };
  });
}
