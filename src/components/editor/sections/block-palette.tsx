"use client";

import * as React from "react";
import { Plus, Search } from "lucide-react";
import { BLOCK_META, BLOCK_TYPES, type BlockType } from "@/lib/blocks/schema";
import { cn, inputClass } from "@/components/ui";

const CATEGORY_LABELS: Record<string, string> = {
  layout: "Layout",
  content: "Content",
  media: "Media",
  "social-proof": "Social proof",
  conversion: "Conversion",
  data: "From your data",
};
const CATEGORY_ORDER = ["layout", "content", "media", "data", "social-proof", "conversion"];

/** "Add block" palette grouped by category with descriptions. */
export function BlockPalette({ onAdd, disabled, compact }: { onAdd: (type: BlockType) => void; disabled?: boolean; compact?: boolean }) {
  const [q, setQ] = React.useState("");
  const query = q.trim().toLowerCase();
  const groups = CATEGORY_ORDER.map((cat) => ({
    key: cat,
    label: CATEGORY_LABELS[cat] ?? cat,
    types: BLOCK_TYPES.filter((t) => BLOCK_META[t].category === cat && (!query || BLOCK_META[t].label.toLowerCase().includes(query) || BLOCK_META[t].description.toLowerCase().includes(query) || t.includes(query))),
  })).filter((g) => g.types.length > 0);
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
        <input className={cn(inputClass, "h-9 pl-8")} placeholder="Search blocks…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {groups.length === 0 && <p className="text-xs text-neutral-500">No blocks match “{q}”.</p>}
      {groups.map((g) => (
        <div key={g.key}>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{g.label}</div>
          <div className={cn("grid gap-1.5", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
            {g.types.map((t) => (
              <button key={t} type="button" disabled={disabled} onClick={() => onAdd(t)} className="group flex items-start gap-2 rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-left hover:border-neutral-900 disabled:opacity-50">
                <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400 group-hover:text-neutral-900" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-neutral-900">{BLOCK_META[t].label}</span>
                  <span className="block text-xs leading-snug text-neutral-500">{BLOCK_META[t].description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
