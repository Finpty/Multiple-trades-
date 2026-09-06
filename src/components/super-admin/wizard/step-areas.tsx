"use client";

import * as React from "react";
import { Button, Checkbox, Input, Select, Textarea } from "@/components/ui";
import { AREA_TYPES } from "./options";
import { uid, type WizardServiceArea } from "./types";
import type { StepProps } from "./wizard";

export function StepAreas({ state, patch }: StepProps) {
  const areas = state.serviceAreas;
  const set = (list: WizardServiceArea[]) => patch({ serviceAreas: list.map((a, i) => ({ ...a, isPrimary: list.some((x) => x.isPrimary) ? a.isPrimary : i === 0 })) });
  const update = (i: number, p: Partial<WizardServiceArea>) => set(areas.map((a, j) => (j === i ? { ...a, ...p } : p.isPrimary ? { ...a, isPrimary: false } : a)));
  const [bulk, setBulk] = React.useState("");
  const addBulk = () => {
    const rows = bulk.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const added: WizardServiceArea[] = rows.map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      const [name, postcode = "", st = state.details.state] = parts;
      const m = name.match(/^(.*?)\s+(\d{3,5})$/);
      return { uid: uid(), name: m ? m[1] : name, type: "SUBURB", postcode: postcode || (m ? m[2] : ""), state: st || "", isPrimary: false };
    });
    const existing = new Set(areas.map((a) => a.name.toLowerCase()));
    set([...areas, ...added.filter((a) => a.name && !existing.has(a.name.toLowerCase()))]);
    setBulk("");
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">Suburbs, cities or regions the business serves. Each area can get its own service-area page (with unique content, to avoid thin pages). Add a few now; manage the full list later.</p>
      <div className="space-y-2">
        {areas.map((a, i) => (
          <div key={a.uid} className="grid gap-2 sm:grid-cols-[2fr_1.2fr_1fr_1fr_auto_auto]">
            <Input value={a.name} placeholder="Name (e.g. Fremantle)" onChange={(e) => update(i, { name: e.target.value })} />
            <Select value={a.type} onChange={(e) => update(i, { type: e.target.value as WizardServiceArea["type"] })}>{AREA_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select>
            <Input value={a.postcode} placeholder="Postcode" onChange={(e) => update(i, { postcode: e.target.value })} />
            <Input value={a.state} placeholder="State" onChange={(e) => update(i, { state: e.target.value })} />
            <Checkbox checked={a.isPrimary} onChange={() => update(i, { isPrimary: true })} label="Primary" />
            <Button type="button" variant="ghost" size="sm" onClick={() => set(areas.filter((_, j) => j !== i))} aria-label="Remove">✕</Button>
          </div>
        ))}
        {areas.length === 0 && <p className="text-sm text-neutral-500">No service areas yet.</p>}
      </div>
      <Button type="button" variant="secondary" onClick={() => set([...areas, { uid: uid(), name: "", type: "SUBURB", postcode: "", state: state.details.state, isPrimary: areas.length === 0 }])}>+ Add area</Button>
      <div className="rounded-lg border border-dashed border-neutral-300 p-3">
        <div className="mb-1 text-sm font-medium">Bulk add</div>
        <p className="mb-2 text-xs text-neutral-500">One per line: <code>Suburb, postcode, STATE</code> or <code>Suburb 6000</code>.</p>
        <Textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={4} placeholder={"Subiaco, 6008, WA\nCottesloe 6011"} />
        <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={addBulk} disabled={!bulk.trim()}>Add lines</Button>
      </div>
    </div>
  );
}
