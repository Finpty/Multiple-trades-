"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Card, CardHeader, Textarea, cn } from "@/components/ui";
import type { FeatureRow } from "@/lib/business/features";
import type { ActionResult } from "@/lib/actions";

export function FeatureToggles({ businessId, features, aiAvailable, toggle, saveConfig }: { businessId: string; features: FeatureRow[]; aiAvailable: boolean; toggle: (b: string, key: string, on: boolean) => Promise<ActionResult>; saveConfig: (b: string, key: string, json: string) => Promise<ActionResult> }) {
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  const router = useRouter();
  const groups = [...new Set(features.map((f) => f.category))];
  return (
    <div className="space-y-6">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {groups.map((g) => (
        <Card key={g}>
          <CardHeader title={g[0].toUpperCase() + g.slice(1)} />
          <ul className="divide-y divide-neutral-100">
            {features.filter((f) => f.category === g).map((f) => (
              <li key={f.key} className={cn("px-5 py-3", f.isPlatformOnly && "opacity-60")}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">{f.name}{f.requiresAi && <Badge tone={aiAvailable ? "purple" : "neutral"}>AI optional</Badge>}{f.isPlatformOnly && <Badge>platform managed</Badge>}</div>
                    {f.description && <div className="text-xs text-neutral-500">{f.description}</div>}
                    {f.hasConfigSchema && <button type="button" className="mt-1 text-xs underline" onClick={() => setOpen(open === f.key ? null : f.key)}>{open === f.key ? "Hide settings" : "Settings"}</button>}
                  </div>
                  <button type="button" role="switch" aria-checked={f.isEnabled} disabled={pending || f.isPlatformOnly} onClick={() => start(async () => { const r = await toggle(businessId, f.key, !f.isEnabled); setMsg(r.ok ? { tone: "success", text: `${f.name} ${!f.isEnabled ? "enabled" : "disabled"}` } : { tone: "danger", text: r.error }); router.refresh(); })} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", f.isEnabled ? "bg-emerald-500" : "bg-neutral-300")}>
                    <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition", f.isEnabled ? "left-[22px]" : "left-0.5")} />
                  </button>
                </div>
                {open === f.key && <ConfigEditor initial={JSON.stringify(f.config, null, 2)} onSave={(json) => start(async () => { const r = await saveConfig(businessId, f.key, json); setMsg(r.ok ? { tone: "success", text: r.message ?? "Saved" } : { tone: "danger", text: r.error }); })} />}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function ConfigEditor({ initial, onSave }: { initial: string; onSave: (json: string) => void }) {
  const [v, setV] = React.useState(initial);
  return <div className="mt-2 space-y-2"><Textarea className="font-mono text-xs" rows={5} value={v} onChange={(e) => setV(e.target.value)} /><Button size="sm" variant="secondary" onClick={() => onSave(v)}>Save settings</Button></div>;
}
