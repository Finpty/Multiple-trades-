"use client";

import * as React from "react";
import * as Icons from "lucide-react";
import { Button, Input, cn } from "@/components/ui";
import { Icon } from "@/components/admin/icon";

const ICON_NAMES: string[] = Object.keys(Icons).filter((k) => /^[A-Z][A-Za-z0-9]+$/.test(k) && !k.endsWith("Icon") && !k.startsWith("Lucide") && k !== "createLucideIcon" && k !== "Icon");

/** Searchable lucide icon picker; submits the icon name in a hidden input. */
export function IconPicker({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const results = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term ? ICON_NAMES.filter((n) => n.toLowerCase().includes(term)) : ICON_NAMES;
    return list.slice(0, 96);
  }, [q]);
  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={value} />
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50">{value ? <Icon name={value} className="h-5 w-5" /> : <span className="text-xs text-neutral-400">—</span>}</div>
        <div className="text-sm text-neutral-700">{value || <span className="text-neutral-400">No icon</span>}</div>
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}>{open ? "Close" : value ? "Change" : "Choose icon"}</Button>
        {value && <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>Remove</Button>}
      </div>
      {open && (
        <div className="rounded-md border border-neutral-200 p-3">
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search icons (e.g. wrench, droplet, home)…" className="mb-3 h-9" />
          <div className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto sm:grid-cols-8 md:grid-cols-12">
            {results.map((n) => (
              <button key={n} type="button" title={n} onClick={() => { onChange(n); setOpen(false); }} className={cn("flex h-9 items-center justify-center rounded-md border hover:border-neutral-900", n === value ? "border-neutral-900 bg-neutral-100" : "border-transparent")}>
                <Icon name={n} className="h-4 w-4" />
              </button>
            ))}
          </div>
          {results.length === 0 && <p className="text-sm text-neutral-500">No icons match.</p>}
        </div>
      )}
    </div>
  );
}
