"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, cn } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";
import { DragHandle, SortableList } from "@/components/admin/content/services/sortable-list";

export interface MaterialRowView { id: string; name: string; category: string; services: string; thumb: string | null; isActive: boolean; archived: boolean }
type State = "activate" | "deactivate" | "archive" | "restore";

export function MaterialsList({ businessId, rows: initial, sortable, setState, reorder }: { businessId: string; rows: MaterialRowView[]; sortable: boolean; setState: (businessId: string, id: string, state: State) => Promise<ActionResult>; reorder: (businessId: string, items: Array<{ id: string; sortOrder: number }>) => Promise<ActionResult<{ count: number }>> }) {
  const router = useRouter();
  const [rows, setRows] = React.useState(initial);
  const [msg, setMsg] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, start] = React.useTransition();
  React.useEffect(() => setRows(initial), [initial]);
  const run = (fn: () => Promise<ActionResult>) => start(async () => { const r = await fn(); setMsg(r.ok ? { tone: "success", text: r.message ?? "Done" } : { tone: "danger", text: r.error }); router.refresh(); });
  const Row = ({ r, handle }: { r: MaterialRowView; handle?: React.ReactNode }) => (
    <div className={cn("grid grid-cols-[auto_44px_minmax(0,1fr)_110px_auto] items-center gap-3 border-b px-2 py-2 text-sm last:border-b-0", (r.archived || !r.isActive) && "opacity-60")}>
      <div className="w-5">{handle}</div>
      <div className="h-11 w-11 overflow-hidden rounded bg-neutral-100">{r.thumb && <img src={r.thumb} alt="" className="h-full w-full object-cover" />}</div>
      <div className="min-w-0"><Link href={`/admin/${businessId}/materials/${r.id}`} className="font-medium hover:underline">{r.name}</Link><div className="truncate text-xs text-neutral-500">{[r.category, r.services].filter(Boolean).join(" · ")}</div></div>
      <div><Badge tone={r.archived ? "neutral" : r.isActive ? "green" : "amber"}>{r.archived ? "ARCHIVED" : r.isActive ? "ACTIVE" : "INACTIVE"}</Badge></div>
      <div className="flex justify-end gap-1">
        {r.archived ? <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setState(businessId, r.id, "restore"))}>Restore</Button> : (<>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setState(businessId, r.id, r.isActive ? "deactivate" : "activate"))}>{r.isActive ? "Deactivate" : "Activate"}</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm(`Archive ${r.name}?`)) run(() => setState(businessId, r.id, "archive")); }}>Archive</Button>
        </>)}
      </div>
    </div>
  );
  return (
    <div className="space-y-3">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="rounded-lg border bg-white">
        {sortable ? <SortableList items={rows} getId={(r) => r.id} onReorder={(next) => { setRows(next); start(async () => { const r = await reorder(businessId, next.map((x, i) => ({ id: x.id, sortOrder: i }))); if (!r.ok) setMsg({ tone: "danger", text: r.error }); }); }} renderItem={(r, _i, h) => <Row r={r} handle={<DragHandle {...h} />} />} /> : rows.map((r) => <Row key={r.id} r={r} />)}
      </div>
    </div>
  );
}
