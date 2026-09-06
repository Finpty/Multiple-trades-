"use client";

import * as React from "react";
import { Input } from "@/components/ui";

export interface CheckboxTreeItem {
  id: string;
  label: string;
  hint?: string | null;
  depth?: number;
  disabled?: boolean;
}

/**
 * Filterable checkbox list (optionally indented by depth) that submits ids as
 * `<name>[]`. Used for service areas, related materials, project services.
 */
export function CheckboxTree({ name, items, selected, onChange, emptyText = "Nothing to choose from yet.", searchable = true }: { name: string; items: CheckboxTreeItem[]; selected: Set<string>; onChange: (next: Set<string>) => void; emptyText?: string; searchable?: boolean }) {
  const [q, setQ] = React.useState("");
  const visible = q.trim() ? items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()) || (i.hint ?? "").toLowerCase().includes(q.trim().toLowerCase())) : items;
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  const setAll = (value: boolean) => {
    const next = new Set(selected);
    for (const i of visible) if (!i.disabled) (value ? next.add(i.id) : next.delete(i.id));
    onChange(next);
  };
  if (items.length === 0) return <p className="rounded-md border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">{emptyText}</p>;
  return (
    <div className="space-y-2">
      {[...selected].map((id) => (
        <input key={id} type="hidden" name={`${name}[]`} value={id} />
      ))}
      <div className="flex flex-wrap items-center gap-2">
        {searchable && items.length > 8 && <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="h-8 max-w-xs text-xs" />}
        <button type="button" className="text-xs text-neutral-600 underline-offset-2 hover:underline" onClick={() => setAll(true)}>Select all</button>
        <button type="button" className="text-xs text-neutral-600 underline-offset-2 hover:underline" onClick={() => setAll(false)}>Clear</button>
        <span className="ml-auto text-xs text-neutral-500">{selected.size} selected</span>
      </div>
      <div className="max-h-72 overflow-y-auto rounded-md border border-neutral-200">
        {visible.length === 0 && <p className="px-3 py-3 text-sm text-neutral-500">No matches.</p>}
        {visible.map((i) => (
          <label key={i.id} className="flex cursor-pointer items-center gap-2 border-b border-neutral-100 px-3 py-2 text-sm last:border-b-0 hover:bg-neutral-50" style={{ paddingLeft: `${12 + (i.depth ?? 0) * 18}px` }}>
            <input type="checkbox" className="h-4 w-4 rounded border-neutral-300" checked={selected.has(i.id)} disabled={i.disabled} onChange={() => toggle(i.id)} />
            <span className="text-neutral-900">{i.label}</span>
            {i.hint && <span className="text-xs text-neutral-500">{i.hint}</span>}
          </label>
        ))}
      </div>
    </div>
  );
}
