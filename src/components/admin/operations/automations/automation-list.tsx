"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, cn } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";

export interface AutomationRowView { id: string; name: string; description: string; trigger: string; summary: string; isActive: boolean; runCount: number; lastRunAt: string | null; lastStatus: string | null }
type State = "enable" | "disable" | "delete" | "duplicate";

export function AutomationList({ businessId, rows, state, test }: { businessId: string; rows: AutomationRowView[]; state: (businessId: string, id: string, s: State) => Promise<ActionResult<{ id?: string }>>; test: (businessId: string, id: string) => Promise<ActionResult<{ status: string; error: string | null; eventAt: string }>> }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<{ tone: "success" | "danger" | "info"; text: string } | null>(null);
  const run = (id: string, s: State) => start(async () => { const r = await state(businessId, id, s); setMsg(r.ok ? { tone: "success", text: r.message ?? "Done" } : { tone: "danger", text: r.error }); router.refresh(); });
  return (
    <div className="space-y-3">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <ul className="divide-y rounded-lg border bg-white">
        {rows.map((r) => (
          <li key={r.id} className={cn("grid gap-3 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_170px_auto] md:items-center", !r.isActive && "opacity-70")}>
            <div className="min-w-0">
              <div className="flex items-center gap-2"><Link href={`/admin/${businessId}/automations/${r.id}`} className="font-medium hover:underline">{r.name}</Link><Badge tone={r.isActive ? "green" : "neutral"}>{r.isActive ? "active" : "paused"}</Badge></div>
              <div className="text-xs text-neutral-600"><span className="font-medium">When</span> {r.trigger} <span className="font-medium">then</span> {r.summary}</div>
              {r.description && <div className="text-xs text-neutral-500">{r.description}</div>}
            </div>
            <div className="text-xs text-neutral-500">{r.runCount} run{r.runCount === 1 ? "" : "s"}{r.lastRunAt ? ` · last ${r.lastRunAt}` : ""}{r.lastStatus ? ` (${r.lastStatus.toLowerCase()})` : ""}</div>
            <div className="flex flex-wrap justify-end gap-1">
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(r.id, r.isActive ? "disable" : "enable")}>{r.isActive ? "Pause" : "Enable"}</Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const t = await test(businessId, r.id); setMsg(t.ok ? { tone: t.data.status === "FAILED" ? "danger" : "info", text: `Test run against the latest event (${new Date(t.data.eventAt).toLocaleString()}): ${t.data.status}${t.data.error ? ` — ${t.data.error}` : ""}` } : { tone: "danger", text: t.error }); router.refresh(); })} title="Run against the most recent matching event">Test</Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(r.id, "duplicate")}>Duplicate</Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm(`Delete “${r.name}”?`)) run(r.id, "delete"); }}>Delete</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
