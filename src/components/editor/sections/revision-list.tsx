"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, EmptyState } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";
import type { PageRevisionView } from "@/lib/website/pages";

export function RevisionList({ businessId, pageId, revisions, restore }: { businessId: string; pageId: string; revisions: PageRevisionView[]; restore: (b: string, p: string, v: number) => Promise<ActionResult> }) {
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const router = useRouter();
  if (revisions.length === 0) return <EmptyState title="No versions yet" description="Versions are created every time the page is published." />;
  return (
    <div className="space-y-3">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Card>
        <ul className="divide-y divide-neutral-100">
          {revisions.map((r) => (
            <li key={r.version} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <div><span className="font-medium">Version {r.version}</span><span className="ml-2 text-neutral-500">{new Date(r.createdAt).toLocaleString()}{r.author ? ` · ${r.author}` : ""}</span>{r.note && <span className="block text-xs text-neutral-500">{r.note}</span>}<span className="block text-xs text-neutral-500">{r.sectionCount} section(s)</span></div>
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => { if (window.confirm(`Restore version ${r.version} into the draft? The current draft is saved as a new version first.`)) start(async () => { const x = await restore(businessId, pageId, r.version); setMsg(x.ok ? { tone: "success", text: x.message ?? "Restored" } : { tone: "danger", text: x.error }); router.refresh(); }); }}>Restore</Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
