import { codeToHtml } from "shiki";
import { CopyButton } from "./copy-button";

/** Server-rendered, dual-theme highlighted code block. */
export async function Code({ code, lang = "ts", title }: { code: string; lang?: string; title?: string }) {
  const src = code.replace(/\n$/, "");
  const html = await codeToHtml(src, {
    lang: lang === "sh" || lang === "shell" ? "bash" : lang,
    themes: { light: "github-light", dark: "github-dark-dimmed" },
    defaultColor: false,
  }).catch(() => `<pre class="shiki"><code>${src.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</code></pre>`);
  return (
    <div className="group relative my-4 overflow-hidden rounded-xl border border-line bg-code">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted">{title ?? lang}</span>
        <CopyButton text={src} />
      </div>
      <div
        className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-6 [&_pre]:!bg-transparent"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
