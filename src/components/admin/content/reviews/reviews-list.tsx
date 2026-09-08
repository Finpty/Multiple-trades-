"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, cn } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";
import { DragHandle, SortableList } from "@/components/admin/content/services/sortable-list";

export interface ReviewRowView { id: string; author: string; rating: number; title: string; excerpt: string; meta: string; isPublished: boolean; isFeatured: boolean; archived: boolean }
type State = "publish" | "hide" | "feature" | "unfeature" | "archive" | "restore";

export function Stars({ n }: { n: number }) {
  return <span className="text-amber-500" aria-label={`${n} out of 5`}>{"★".repeat(n)}<span className="text-neutral-300">{"★".repeat(5 - n)}</span></span>;
}

export function ReviewsList({ businessId, rows: initial, sortable, setState, reorder }: { businessId: string; rows: ReviewRowView[]; sortable: boolean; setState: (businessId: string, id: string, state: State) => Promise<ActionResult>; reorder: (businessId: string, items: Array<{ id: string; sortOrder: number }>) => Promise<ActionResult<{ count: number }>> }) {
  const router = useRouter();
  const [rows, setRows] = React.useState(initial);
  const [msg, setMsg] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, start] = React.useTransition();
  React.useEffect(() => setRows(initial), [initial]);
  const run = (fn: () => Promise<ActionResult>) => start(async () => { const r = await fn(); setMsg(r.ok ? { tone: "success", text: r.message ?? "Done" } : { tone: "danger", text: r.error }); router.refresh(); });
  const Row = ({ r, handle }: { r: ReviewRowView; handle?: React.ReactNode }) => (
    <div className={cn("grid grid-cols-[auto_minmax(0,1fr)_130px_auto] items-center gap-3 border-b px-2 py-2 text-sm last:border-b-0", (r.archived || !r.isPublished) && "opacity-60")}>
      <div className="w-5">{handle}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-2"><Link href={`/admin/${businessId}/reviews/${r.id}`} className="font-medium hover:underline">{r.author}</Link><Stars n={r.rating} />{r.title && <span className="truncate text-neutral-600">— {r.title}</span>}</div>
        <div className="truncate text-xs text-neutral-500">{r.excerpt}</div>
        <div className="text-[11px] text-neutral-400">{r.meta}</div>
      </div>
      <div className="flex flex-wrap gap-1"><Badge tone={r.archived ? "neutral" : r.isPublished ? "green" : "amber"}>{r.archived ? "ARCHIVED" : r.isPublished ? "PUBLISHED" : "HIDDEN"}</Badge>{r.isFeatured && <Badge tone="purple">featured</Badge>}</div>
      <div className="flex justify-end gap-1">
        {r.archived ? <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setState(businessId, r.id, "restore"))}>Restore</Button> : (<>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setState(businessId, r.id, r.isPublished ? "hide" : "publish"))}>{r.isPublished ? "Hide" : "Publish"}</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setState(businessId, r.id, r.isFeatured ? "unfeature" : "feature"))} title="Featured reviews appear first">{r.isFeatured ? "★" : "☆"}</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm("Archive this review?")) run(() => setState(businessId, r.id, "archive")); }}>Archive</Button>
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
