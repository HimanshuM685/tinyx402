"use client";
import { useState } from "react";

export function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); })}
      className={`rounded-md border border-line bg-surface px-2 py-1 font-mono text-[11px] text-muted hover:text-ink ${className}`}
      aria-label="Copy to clipboard"
    >
      {done ? "copied" : "copy"}
    </button>
  );
}
