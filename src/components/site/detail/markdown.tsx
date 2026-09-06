import { parseMarkdown, type InlineNode, type MarkdownBlock } from "@/lib/site/detail";

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.kind) {
          case "text":
            return <React.Fragment key={i}>{n.text}</React.Fragment>;
          case "strong":
            return <strong key={i}><Inline nodes={n.children} /></strong>;
          case "em":
            return <em key={i}><Inline nodes={n.children} /></em>;
          case "code":
            return <code key={i} className="rounded px-1 py-0.5 text-[0.9em]" style={{ background: "var(--color-surface)" }}><Inline nodes={n.children} /></code>;
          case "link": {
            const external = /^https?:\/\//i.test(n.href);
            return (
              <a key={i} href={n.href} className="underline underline-offset-2 hover:opacity-70" style={{ color: "var(--color-accent)" }} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                <Inline nodes={n.children} />
              </a>
            );
          }
        }
      })}
    </>
  );
}

import * as React from "react";

function Block({ block }: { block: MarkdownBlock }) {
  switch (block.kind) {
    case "heading": {
      const Tag = `h${block.level}` as "h2" | "h3" | "h4";
      const size = block.level === 2 ? "text-2xl" : block.level === 3 ? "text-xl" : "text-lg";
      return <Tag className={`${size} mt-8 mb-3 font-semibold first:mt-0`}><Inline nodes={block.children} /></Tag>;
    }
    case "paragraph":
      return <p className="my-4 leading-relaxed"><Inline nodes={block.children} /></p>;
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className={`my-4 space-y-1.5 pl-6 ${block.ordered ? "list-decimal" : "list-disc"}`}>
          {block.items.map((item, i) => <li key={i} className="leading-relaxed"><Inline nodes={item} /></li>)}
        </Tag>
      );
    }
    case "quote":
      return <blockquote className="my-4 border-l-4 pl-4 italic opacity-85" style={{ borderColor: "var(--color-accent)" }}><Inline nodes={block.children} /></blockquote>;
  }
}

/**
 * Renders owner-authored Markdown (headings, paragraphs, lists, quotes, bold,
 * italic, links) as React elements — no raw HTML is ever injected.
 */
export function Markdown({ source, className = "" }: { source: string | null | undefined; className?: string }) {
  const blocks = parseMarkdown(source);
  if (blocks.length === 0) return null;
  return (
    <div className={`site-prose ${className}`}>
      {blocks.map((b, i) => <Block key={i} block={b} />)}
    </div>
  );
}
