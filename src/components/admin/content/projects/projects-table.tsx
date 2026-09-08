"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, cn, statusTone } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";
import { SortableList, DragHandle } from "@/components/admin/content/services/sortable-list";

export interface ProjectRowView {
  id: string; title: string; slug: string; location: string; completed: string; status: string; isFeatured: boolean; deleted: boolean; updatedAt: string; thumb: string | null; services: string[]; mediaCount: number;
}

interface Actions {
  setStatus: (businessId: string, id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") => Promise<ActionResult>;
  setFeatured: (businessId: string, id: string, value: boolean) => Promise<ActionResult>;
  remove: (businessId: string, id: string) => Promise<ActionResult>;
  restore: (businessId: string, id: string) => Promise<ActionResult>;
  reorder: (businessId: string, items: Array<{ id: string; sortOrder: number }>) => Promise<ActionResult<{ count: number }>>;
}

export function ProjectsTable({ businessId, siteSlug, rows: initial, sortable, actions }: { businessId: string; siteSlug: string; rows: ProjectRowView[]; sortable: boolean; actions: Actions }) {
  const router = useRouter();
  const [rows, setRows] = React.useState(initial);
  const [msg, setMsg] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, start] = React.useTransition();
  React.useEffect(() => setRows(initial), [initial]);
  const run = (fn: () => Promise<ActionResult>) => start(async () => { const r = await fn(); setMsg(r.ok ? { tone: "success", text: r.message ?? "Done" } : { tone: "danger", text: r.error }); router.refresh(); });
  const base = `/admin/${businessId}/projects`;

  const Row = ({ r, handle }: { r: ProjectRowView; handle?: React.ReactNode }) => (
    <div className={cn("grid grid-cols-[auto_56px_minmax(0,1fr)_120px_110px_auto] items-center gap-3 border-b px-2 py-2 text-sm last:border-b-0", r.deleted && "opacity-60")}>
      <div className="w-5">{handle}</div>
      <div className="h-12 w-14 overflow-hidden rounded bg-neutral-100">{r.thumb ? <img src={r.thumb} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[10px] text-neutral-400">{r.mediaCount} media</span>}</div>
      <div className="min-w-0">
        <Link href={`${base}/${r.id}`} className="font-medium hover:underline">{r.title}</Link>
        <div className="truncate text-xs text-neutral-500">{[r.location, r.completed, r.services.join(", ")].filter(Boolean).join(" · ")}</div>
      </div>
      <div className="flex flex-wrap gap-1"><Badge tone={r.deleted ? "neutral" : statusTone(r.status)}>{r.deleted ? "DELETED" : r.status}</Badge>{r.isFeatured && <Badge tone="purple">featured</Badge>}</div>
      <div className="text-xs text-neutral-500">{r.updatedAt}</div>
      <div className="flex flex-wrap justify-end gap-1">
        {r.deleted ? (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => actions.restore(businessId, r.id))}>Restore</Button>
        ) : (
          <>
            <a href={`/${siteSlug}/projects/${r.slug}?__preview=draft`} target="_blank" rel="noreferrer" className="rounded px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100">Preview</a>
            {r.status !== "PUBLISHED" ? <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => actions.setStatus(businessId, r.id, "PUBLISHED"))}>Publish</Button> : <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => actions.setStatus(businessId, r.id, "DRAFT"))}>Unpublish</Button>}
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => actions.setFeatured(businessId, r.id, !r.isFeatured))} title="Featured projects appear first in portfolio blocks">{r.isFeatured ? "★" : "☆"}</Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm(`Delete “${r.title}”? You can restore it from the Deleted filter.`)) run(() => actions.remove(businessId, r.id)); }}>Delete</Button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="rounded-lg border bg-white">
        {sortable ? (
          <SortableList
            items={rows}
            getId={(r) => r.id}
            onReorder={(next) => { setRows(next); start(async () => { const r = await actions.reorder(businessId, next.map((x, i) => ({ id: x.id, sortOrder: i }))); if (!r.ok) setMsg({ tone: "danger", text: r.error }); }); }}
            renderItem={(r, _index, handleProps) => <Row r={r} handle={<DragHandle {...handleProps} />} />}
          />
        ) : rows.map((r) => <Row key={r.id} r={r} />)}
      </div>
      {sortable && <p className="text-xs text-neutral-500">Drag rows to change the order projects appear on the website.</p>}
    </div>
  );
}
