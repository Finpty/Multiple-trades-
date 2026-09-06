"use client";

import Link from "next/link";
import { Button, Input, Select, cn } from "@/components/ui";
import { PRICING_ITEM_TYPES } from "./options";
import { uid, type WizardPricingItem } from "./types";
import type { StepProps } from "./wizard";

const snake = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);

export function StepPricing({ state, patch, errors }: StepProps) {
  const items = state.pricingItems;
  const set = (list: WizardPricingItem[]) => patch({ pricingItems: list });
  const update = (i: number, p: Partial<WizardPricingItem>) => set(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))];
  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">Rates, fees, multipliers and percentages the pricing engine, quotes and the website calculator use. Amounts in <strong>{state.details.currency}</strong>. Pricing <em>rules</em> (IF … THEN …) are configured later in the business admin.</p>
      <div className="hidden grid-cols-[2fr_1.4fr_1.2fr_1fr_0.8fr_1fr_auto] gap-2 text-xs font-medium uppercase text-neutral-500 sm:grid"><span>Label</span><span>Key</span><span>Type</span><span>Amount</span><span>Unit</span><span>Category</span><span /></div>
      <div className="space-y-2">
        {items.map((p, i) => (
          <div key={p.uid} className="grid gap-2 sm:grid-cols-[2fr_1.4fr_1.2fr_1fr_0.8fr_1fr_auto]">
            <Input value={p.label} placeholder="Label" className={cn(errors[`pricingItems.${i}.label`] && "border-red-500")} onChange={(e) => update(i, { label: e.target.value, key: p.key || snake(e.target.value) })} />
            <Input value={p.key} placeholder="key" className={cn(errors[`pricingItems.${i}.key`] && "border-red-500")} onChange={(e) => update(i, { key: snake(e.target.value) })} />
            <Select value={p.type} onChange={(e) => update(i, { type: e.target.value as WizardPricingItem["type"] })}>{PRICING_ITEM_TYPES.map((t) => <option key={t.value} value={t.value} title={t.hint}>{t.label}</option>)}</Select>
            <Input type="number" step="0.01" value={p.amount} className={cn(errors[`pricingItems.${i}.amount`] && "border-red-500")} onChange={(e) => update(i, { amount: e.target.value })} />
            <Input value={p.unit} placeholder="m²" onChange={(e) => update(i, { unit: e.target.value })} />
            <Input value={p.category} placeholder="labour" list="wizard-pricing-categories" onChange={(e) => update(i, { category: e.target.value })} />
            <Button type="button" variant="ghost" size="sm" onClick={() => set(items.filter((_, j) => j !== i))} aria-label="Remove">✕</Button>
          </div>
        ))}
      </div>
      <datalist id="wizard-pricing-categories">{["labour", "materials", "fees", "preparation", "finish", "complexity", "business", ...categories].map((c) => <option key={c} value={c} />)}</datalist>
      {Object.keys(errors).some((k) => k.startsWith("pricingItems.")) && <p className="text-xs text-red-600">{Object.entries(errors).filter(([k]) => k.startsWith("pricingItems."))[0]?.[1]}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={() => set([...items, { uid: uid(), key: "", label: "", type: "RATE", amount: "0", unit: "", category: "labour" }])}>+ Add pricing item</Button>
        <Link href="/super-admin/industries" className="self-center text-xs text-neutral-500 underline">Change industry defaults</Link>
      </div>
    </div>
  );
}
