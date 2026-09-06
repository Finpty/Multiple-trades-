"use client";

import * as React from "react";
import { Textarea, cn } from "@/components/ui";

/** Minimal, dependency-free Markdown → HTML for previews (headings, lists, bold/italic, links, code, paragraphs). Input is escaped first. */
export function renderMarkdown(src: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const inline = (s: string) =>
    esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|tel:|\/)[^)\s]+)\)/g, '<a href="$2" rel="noreferrer">$1</a>');
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join("<br/>")}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.type}>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (line.trim() === "") {
      flushPara();
      flushList();
    } else if (h) {
      flushPara();
      flushList();
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
    } else if (ul || ol) {
      flushPara();
      const type = ul ? "ul" : "ol";
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((ul ?? ol)![1]);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return out.join("\n");
}

/** Markdown textarea with a Write / Preview toggle. Keeps a single <textarea name> so the form submits it. */
export function MarkdownField({ name, value, onChange, placeholder, rows = 12, extra }: { name: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; extra?: React.ReactNode }) {
  const [mode, setMode] = React.useState<"write" | "preview">("write");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-neutral-200 p-0.5 text-xs">
          <button type="button" onClick={() => setMode("write")} className={cn("rounded px-2.5 py-1", mode === "write" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100")}>Write</button>
          <button type="button" onClick={() => setMode("preview")} className={cn("rounded px-2.5 py-1", mode === "preview" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100")}>Preview</button>
        </div>
        <div className="flex items-center gap-2">{extra}</div>
      </div>
      <Textarea name={name} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className={cn("font-mono text-[13px]", mode === "preview" && "hidden")} />
      {mode === "preview" && (
        <div className="min-h-[96px] rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
          {value.trim() ? <div className="prose-sm max-w-none [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_code]:rounded [&_code]:bg-neutral-200 [&_code]:px-1" dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }} /> : <p className="text-neutral-400">Nothing to preview yet.</p>}
        </div>
      )}
      <p className="text-xs text-neutral-500">Markdown supported: # headings, **bold**, *italic*, - lists, [links](/quote).</p>
    </div>
  );
}
