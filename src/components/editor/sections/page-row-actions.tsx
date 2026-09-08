"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";

export function PageRowActions({ businessId, page, siteUrl, lifecycle, schedule, canPublish }: { businessId: string; page: { id: string; slug: string; status: string; kind: string }; siteUrl: string; lifecycle: (b: string, p: string, a: "publish" | "unpublish" | "duplicate" | "archive" | "restore" | "cancelSchedule") => Promise<ActionResult<{ id?: string }>>; schedule: (b: string, p: string, iso: string) => Promise<ActionResult>; canPublish: boolean }) {
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);
  const router = useRouter();
  const run = (fn: () => Promise<ActionResult<unknown>>) => start(async () => { const r = await fn(); if (!r.ok) setErr(r.error); else { setErr(null); router.refresh(); } });
  const b = `/admin/${businessId}/website`;
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {err && <span className="text-xs text-red-600">{err}</span>}
      <Link href={`${b}/editor?page=${page.id}`} className="rounded px-2 py-1 text-xs underline">Live edit</Link>
      <Link href={`${b}/pages/${page.id}/settings`} className="rounded px-2 py-1 text-xs underline">Settings</Link>
      <a href={`${siteUrl}${page.slug ? `/${page.slug}` : ""}?__preview=draft`} target="_blank" rel="noreferrer" className="rounded px-2 py-1 text-xs underline">Preview</a>
      {page.status !== "ARCHIVED" && canPublish && (page.status === "PUBLISHED" ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => lifecycle(businessId, page.id, "publish"))}>Re-publish</Button> : <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => lifecycle(businessId, page.id, "publish"))}>Publish</Button>)}
      {page.status === "PUBLISHED" && canPublish && <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm("Unpublish this page? Visitors will get a not-found page.")) run(() => lifecycle(businessId, page.id, "unpublish")); }}>Unpublish</Button>}
      {page.status !== "ARCHIVED" && canPublish && page.status !== "SCHEDULED" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => { const v = window.prompt("Publish at (YYYY-MM-DD HH:MM, local time)"); if (v) run(() => schedule(businessId, page.id, new Date(v.replace(" ", "T")).toISOString())); }}>Schedule</Button>}
      {page.status === "SCHEDULED" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => lifecycle(businessId, page.id, "cancelSchedule"))}>Cancel schedule</Button>}
      <Link href={`${b}/pages/${page.id}/history`} className="rounded px-2 py-1 text-xs underline">History</Link>
      {page.status !== "ARCHIVED" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => lifecycle(businessId, page.id, "duplicate"))}>Duplicate</Button>}
      {page.status !== "ARCHIVED" && page.kind !== "SYSTEM" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm("Archive this page?")) run(() => lifecycle(businessId, page.id, "archive")); }}>Archive</Button>}
      {page.status === "ARCHIVED" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => lifecycle(businessId, page.id, "restore"))}>Restore</Button>}
    </div>
  );
}
