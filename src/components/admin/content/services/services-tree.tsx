"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { Badge, cn, statusTone } from "@/components/ui";
import { reorderServicesAction, toggleServiceFlagAction } from "@/app/admin/[businessId]/services/actions";
import { DragHandle, SortableList } from "./sortable-list";

export interface ServiceTreeRowView {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  pricingMethod: string;
  pricingRange: string | null;
  isEnabled: boolean;
  isFeatured: boolean;
  status: string;
  areasCount: number;
  updatedAt: string;
  archived: boolean;
}

type Row = ServiceTreeRowView & { depth: number };

/** Rebuilds a consistent depth-first order from (flat order, parentId). Orphans become roots. */
function rebuild(rows: Row[]): Row[] {
  const ids = new Set(rows.map((r) => r.id));
  const byParent = new Map<string | null, Row[]>();
  for (const r of rows) {
    const key = r.parentId && ids.has(r.parentId) && r.parentId !== r.id ? r.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), { ...r, parentId: key }]);
  }
  const out: Row[] = [];
  const walk = (parentId: string | null, depth: number, seen: Set<string>) => {
    for (const r of byParent.get(parentId) ?? []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({ ...r, depth });
      walk(r.id, depth + 1, seen);
    }
  };
  walk(null, 0, new Set());
  // Anything trapped in a cycle is appended as a root.
  for (const r of rows) if (!out.some((o) => o.id === r.id)) out.push({ ...r, parentId: null, depth: 0 });
  return out;
}

function subtreeIds(rows: Row[], id: string): Set<string> {
  const set = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of rows) if (r.parentId && set.has(r.parentId) && !set.has(r.id)) {
      set.add(r.id);
      grew = true;
    }
  }
  return set;
}

export function ServicesTree({ businessId, rows: initial, sortable }: { businessId: string; rows: Row[]; sortable: boolean }) {
  const router = useRouter();
  const [rows, setRows] = React.useState<Row[]>(initial);
  const [status, setStatus] = React.useState<{ tone: "info" | "danger"; text: string } | null>(null);
  const [pending, startTransition] = React.useTransition();
  React.useEffect(() => setRows(initial), [initial]);

  const persist = (next: Row[]) => {
    const rebuilt = rebuild(next);
    setRows(rebuilt);
    const counters = new Map<string | null, number>();
    const items = rebuilt.map((r) => {
      const n = counters.get(r.parentId) ?? 0;
      counters.set(r.parentId, n + 1);
      return { id: r.id, parentId: r.parentId, sortOrder: n };
    });
    setStatus({ tone: "info", text: "Saving order…" });
    startTransition(async () => {
      const res = await reorderServicesAction(businessId, items);
      if (res.ok) {
        setStatus(null);
        router.refresh();
      } else {
        setStatus({ tone: "danger", text: res.error });
        setRows(initial);
      }
    });
  };

  const onReorder = (_next: Row[], moved: { from: number; to: number }) => {
    const active = rows[moved.from];
    const over = rows[moved.to];
    if (!active || !over) return;
    const block = subtreeIds(rows, active.id);
    if (block.has(over.id)) return; // cannot drop inside its own subtree
    const blockRows = rows.filter((r) => block.has(r.id));
    const rest = rows.filter((r) => !block.has(r.id));
    let insertAt = rest.findIndex((r) => r.id === over.id);
    if (moved.from < moved.to) {
      // Moving down: land after the over item and its subtree so we become its next sibling.
      const overBlock = subtreeIds(rest, over.id);
      insertAt = rest.reduce((last, r, i) => (overBlock.has(r.id) ? i : last), insertAt) + 1;
    }
    const moved1 = { ...active, parentId: over.parentId };
    const next = [...rest.slice(0, insertAt), moved1, ...blockRows.filter((r) => r.id !== active.id), ...rest.slice(insertAt)];
    persist(next);
  };

  const indent = (id: string) => {
    const idx = rows.findIndex((r) => r.id === id);
    const me = rows[idx];
    if (!me) return;
    // Previous sibling = nearest earlier row with the same parent.
    let sibling: Row | undefined;
    for (let i = idx - 1; i >= 0; i--) {
      if (rows[i].parentId === me.parentId) {
        sibling = rows[i];
        break;
      }
      if (rows[i].depth < me.depth) break;
    }
    if (!sibling) return;
    persist(rows.map((r) => (r.id === id ? { ...r, parentId: sibling!.id } : r)));
  };

  const outdent = (id: string) => {
    const me = rows.find((r) => r.id === id);
    if (!me || !me.parentId) return;
    const parent = rows.find((r) => r.id === me.parentId);
    persist(rows.map((r) => (r.id === id ? { ...r, parentId: parent?.parentId ?? null } : r)));
  };

  const toggle = (id: string, flag: "isEnabled" | "isFeatured", value: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [flag]: value } : r)));
    startTransition(async () => {
      const res = await toggleServiceFlagAction(businessId, id, flag, value);
      if (!res.ok) {
        setStatus({ tone: "danger", text: res.error });
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [flag]: !value } : r)));
      } else router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      {status && <div className={cn("rounded-md px-3 py-2 text-xs", status.tone === "danger" ? "bg-red-50 text-red-700" : "bg-sky-50 text-sky-800")}>{status.text}</div>}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[40px_minmax(220px,2fr)_minmax(160px,1.4fr)_90px_60px_100px_70px_110px] items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <span />
            <span>Name</span>
            <span>Pricing</span>
            <span>Enabled</span>
            <span>Featured</span>
            <span>Status</span>
            <span>Areas</span>
            <span>Updated</span>
          </div>
          <SortableList
            items={rows}
            getId={(r) => r.id}
            onReorder={onReorder}
            disabled={!sortable || pending}
            className="divide-y divide-neutral-100"
            renderItem={(r, _i, handle) => (
              <div className="grid grid-cols-[40px_minmax(220px,2fr)_minmax(160px,1.4fr)_90px_60px_100px_70px_110px] items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50">
                <div>{sortable ? <DragHandle {...handle} /> : <span />}</div>
                <div className="flex min-w-0 items-center gap-1" style={{ paddingLeft: `${r.depth * 20}px` }}>
                  {sortable && (
                    <span className="flex shrink-0">
                      <button type="button" title="Outdent (make top-level or sibling of parent)" aria-label="Outdent" disabled={r.depth === 0 || pending} onClick={() => outdent(r.id)} className="inline-flex h-6 w-5 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30">
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" title="Indent (nest under the service above)" aria-label="Indent" disabled={pending} onClick={() => indent(r.id)} className="inline-flex h-6 w-5 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                  <div className="min-w-0">
                    <Link href={`/admin/${businessId}/services/${r.id}`} className="block truncate font-medium text-neutral-900 hover:underline">{r.name}</Link>
                    <div className="truncate text-xs text-neutral-500">/{r.slug}</div>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-neutral-800">{r.pricingMethod}</div>
                  {r.pricingRange && <div className="truncate text-xs text-neutral-500">{r.pricingRange}</div>}
                </div>
                <div>
                  <button type="button" role="switch" aria-checked={r.isEnabled} aria-label={r.isEnabled ? "Disable service" : "Enable service"} disabled={r.archived || pending} onClick={() => toggle(r.id, "isEnabled", !r.isEnabled)} className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50" style={{ backgroundColor: r.isEnabled ? "#10b981" : "#d4d4d4" }}>
                    <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition", r.isEnabled ? "translate-x-5" : "translate-x-0.5")} />
                  </button>
                </div>
                <div>
                  <button type="button" aria-pressed={r.isFeatured} aria-label={r.isFeatured ? "Remove from featured" : "Mark as featured"} disabled={r.archived || pending} onClick={() => toggle(r.id, "isFeatured", !r.isFeatured)} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-neutral-100 disabled:opacity-50">
                    <Star className={cn("h-4 w-4", r.isFeatured ? "fill-amber-400 text-amber-500" : "text-neutral-300")} />
                  </button>
                </div>
                <div>
                  <Badge tone={r.archived ? "neutral" : statusTone(r.status)}>{r.archived ? "ARCHIVED" : r.status}</Badge>
                </div>
                <div className="text-neutral-700">{r.areasCount}</div>
                <div className="text-xs text-neutral-500">{r.updatedAt}</div>
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}
