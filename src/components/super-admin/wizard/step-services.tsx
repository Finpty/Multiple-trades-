"use client";

import { Alert, Button, Checkbox, Input, Select, cn } from "@/components/ui";
import { PRICING_METHODS } from "./options";
import { slugifyClient, uid, type WizardService } from "./types";
import type { StepProps } from "./wizard";

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function StepServices({ state, patch, errors, catalog }: StepProps) {
  const industry = catalog.industries.find((i) => i.id === state.industryId);
  const services = state.services;
  const set = (list: WizardService[]) => patch({ services: list });
  const update = (i: number, p: Partial<WizardService>) => set(services.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const add = (afterIndex?: number, depth = 0) => {
    const item: WizardService = { uid: uid(), depth, name: "", slug: "", shortDescription: "", pricingMethod: "QUOTE", priceMin: "", priceMax: "", priceUnit: "", ctaLabel: "", isEnabled: true };
    if (afterIndex === undefined) set([...services, item]);
    else set([...services.slice(0, afterIndex + 1), item, ...services.slice(afterIndex + 1)]);
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">Pre-filled from the <strong>{industry?.name ?? "industry"}</strong> defaults. Add, rename, reorder or nest services; each becomes an editable page on the website.</p>
      {errors.services && <Alert tone="danger">{errors.services}</Alert>}
      <div className="space-y-2">
        {services.map((s, i) => (
          <div key={s.uid} className={cn("rounded-lg border bg-white p-3", s.depth > 0 ? "ml-8 border-neutral-200" : "border-neutral-300", !s.isEnabled && "opacity-60")}>
            <div className="flex flex-wrap items-center gap-2">
              <Input value={s.name} placeholder="Service name" className={cn("max-w-xs font-medium", errors[`services.${i}.name`] && "border-red-500")} onChange={(e) => update(i, { name: e.target.value, slug: s.slug && s.slug !== slugifyClient(s.name) ? s.slug : slugifyClient(e.target.value) })} />
              <Select value={s.pricingMethod} className="w-auto" onChange={(e) => update(i, { pricingMethod: e.target.value as WizardService["pricingMethod"] })}>
                {PRICING_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
              {s.pricingMethod !== "QUOTE" && (
                <>
                  <Input type="number" step="0.01" value={s.priceMin} placeholder="From $" className="w-24" onChange={(e) => update(i, { priceMin: e.target.value })} />
                  <Input type="number" step="0.01" value={s.priceMax} placeholder="To $" className="w-24" onChange={(e) => update(i, { priceMax: e.target.value })} />
                  <Input value={s.priceUnit} placeholder="unit" className="w-20" onChange={(e) => update(i, { priceUnit: e.target.value })} />
                </>
              )}
              <span className="flex-1" />
              <Checkbox checked={s.isEnabled} onChange={(e) => update(i, { isEnabled: e.target.checked })} label="Enabled" />
              <Button type="button" variant="ghost" size="sm" disabled={s.depth === 0 && (i === 0 || services[i - 1].depth < 0)} onClick={() => update(i, { depth: s.depth === 0 ? 1 : 0 })} title={s.depth === 0 ? "Nest under the service above" : "Un-nest"}>{s.depth === 0 ? "→ Nest" : "← Un-nest"}</Button>
              <Button type="button" variant="ghost" size="sm" disabled={i === 0} onClick={() => set(move(services, i, i - 1))} aria-label="Move up">↑</Button>
              <Button type="button" variant="ghost" size="sm" disabled={i === services.length - 1} onClick={() => set(move(services, i, i + 1))} aria-label="Move down">↓</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => set(services.filter((_, j) => j !== i))} aria-label="Remove">✕</Button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_160px_160px]">
              <Input value={s.shortDescription} placeholder="Short description (shown on cards)" onChange={(e) => update(i, { shortDescription: e.target.value })} />
              <Input value={s.slug} placeholder="slug" onChange={(e) => update(i, { slug: slugifyClient(e.target.value) })} />
              <Input value={s.ctaLabel} placeholder="CTA label (optional)" onChange={(e) => update(i, { ctaLabel: e.target.value })} />
            </div>
            {errors[`services.${i}.name`] && <p className="mt-1 text-xs text-red-600">{errors[`services.${i}.name`]}</p>}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={() => add()}>+ Add service</Button>
        {industry && <Button type="button" variant="ghost" onClick={() => patch({ services: [] })} disabled={services.length === 0}>Clear all</Button>}
      </div>
    </div>
  );
}
