"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ServiceAreaType } from "@prisma/client";
import { Alert, Button, Input, cn } from "@/components/ui";
import { AREA_TYPE_LABELS } from "@/lib/content/areas";
import { saveMatrixAction } from "@/app/admin/[businessId]/areas/actions";

export interface MatrixProps {
  businessId: string;
  areas: Array<{ id: string; name: string; type: ServiceAreaType; depth: number; isEnabled: boolean }>;
  services: Array<{ id: string; name: string; depth: number }>;
  links: string[];
}

/**
 * Areas × services grid. Cells toggle locally; row/column header buttons bulk
 * toggle; "Save changes" sends only the diff to the server action.
 */
export function ServiceMatrix(p: MatrixProps) {
  const router = useRouter();
  const initial = React.useMemo(() => new Set(p.links), [p.links]);
  const [on, setOn] = React.useState<Set<string>>(new Set(p.links));
  React.useEffect(() => setOn(new Set(p.links)), [p.links]);
  const [q, setQ] = React.useState("");
  const [message, setMessage] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, startTransition] = React.useTransition();

  const key = (a: string, s: string) => `${a}:${s}`;
  const visibleAreas = q.trim() ? p.areas.filter((a) => a.name.toLowerCase().includes(q.trim().toLowerCase())) : p.areas;
  const changes: Array<{ areaId: string; serviceId: string; on: boolean }> = [];
  for (const a of p.areas) for (const s of p.services) {
    const k = key(a.id, s.id);
    if (on.has(k) !== initial.has(k)) changes.push({ areaId: a.id, serviceId: s.id, on: on.has(k) });
  }

  const toggleCell = (a: string, s: string) => {
    const next = new Set(on);
    const k = key(a, s);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setOn(next);
  };
  const setMany = (keys: string[], value: boolean) => {
    const next = new Set(on);
    for (const k of keys) value ? next.add(k) : next.delete(k);
    setOn(next);
  };
  const rowKeys = (a: string) => p.services.map((s) => key(a, s.id));
  const colKeys = (s: string) => visibleAreas.map((a) => key(a.id, s));
  const allOn = (keys: string[]) => keys.length > 0 && keys.every((k) => on.has(k));

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await saveMatrixAction(p.businessId, changes);
      if (!res.ok) setMessage({ tone: "danger", text: res.error });
      else {
        setMessage({ tone: "success", text: res.message ?? "Saved." });
        router.refresh();
      }
    });
  };

  if (p.areas.length === 0 || p.services.length === 0) {
    return (
      <Alert tone="info" title={p.areas.length === 0 ? "Add service areas first" : "Add services first"}>
        The matrix needs at least one area and one service. {p.areas.length === 0 ? <Link href={`/admin/${p.businessId}/areas/new?tab=bulk`} className="underline">Bulk add areas</Link> : <Link href={`/admin/${p.businessId}/services/new`} className="underline">Add a service</Link>}.
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter areas…" className="w-full sm:w-64" />
        <span className="text-xs text-neutral-500">{visibleAreas.length} of {p.areas.length} areas · {p.services.length} services</span>
        <div className="ml-auto flex items-center gap-2">
          {changes.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => setOn(new Set(initial))} disabled={pending}>Discard</Button>}
          <Button type="button" onClick={save} disabled={pending || changes.length === 0}>{pending ? "Saving…" : `Save ${changes.length} change${changes.length === 1 ? "" : "s"}`}</Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-50">
              <th className="sticky left-0 z-10 min-w-[14rem] border-b border-r border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Area</th>
              {p.services.map((s) => (
                <th key={s.id} className="border-b border-neutral-200 px-2 py-2 text-center align-bottom">
                  <div className="mx-auto flex max-w-[6.5rem] flex-col items-center gap-1">
                    <span className={cn("line-clamp-2 text-xs font-medium text-neutral-800", s.depth > 0 && "text-neutral-500")} title={s.name}>{s.depth > 0 ? "↳ " : ""}{s.name}</span>
                    <button type="button" className="text-[11px] text-neutral-500 underline-offset-2 hover:underline" onClick={() => setMany(colKeys(s.id), !allOn(colKeys(s.id)))}>{allOn(colKeys(s.id)) ? "none" : "all"}</button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleAreas.map((a) => (
              <tr key={a.id} className={cn("hover:bg-neutral-50", !a.isEnabled && "text-neutral-400")}>
                <td className="sticky left-0 z-10 border-b border-r border-neutral-100 bg-white px-3 py-1.5">
                  <div className="flex items-center gap-2" style={{ paddingLeft: `${a.depth * 0.75}rem` }}>
                    <Link href={`/admin/${p.businessId}/areas/${a.id}`} className="truncate font-medium text-neutral-900 hover:underline">{a.name}</Link>
                    <span className="text-[11px] text-neutral-400">{AREA_TYPE_LABELS[a.type]}</span>
                    <button type="button" className="ml-auto text-[11px] text-neutral-500 underline-offset-2 hover:underline" onClick={() => setMany(rowKeys(a.id), !allOn(rowKeys(a.id)))}>{allOn(rowKeys(a.id)) ? "none" : "all"}</button>
                  </div>
                </td>
                {p.services.map((s) => {
                  const k = key(a.id, s.id);
                  const changed = on.has(k) !== initial.has(k);
                  return (
                    <td key={s.id} className={cn("border-b border-neutral-100 px-2 py-1.5 text-center", changed && "bg-amber-50")}>
                      <input type="checkbox" aria-label={`${s.name} in ${a.name}`} checked={on.has(k)} onChange={() => toggleCell(a.id, s.id)} className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900" />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500">Areas with no ticked services show every enabled service on their page. Changed cells are highlighted until saved.</p>
    </div>
  );
}
