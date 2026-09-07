"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardBody, CardHeader, Checkbox, EmptyState, Field, Input, Select, Textarea, cn } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import type { ActionResult } from "@/lib/actions";
import { formatCents } from "@/lib/money";

export interface PricingItemRow { id: string; key: string; label: string; type: "RATE" | "FEE" | "MULTIPLIER" | "PERCENT"; amount: number; unit: string | null; category: string | null; description: string | null; serviceId: string | null; serviceName: string | null; isActive: boolean }

const TYPE_LABEL: Record<PricingItemRow["type"], string> = { RATE: "Rate", FEE: "Fee", MULTIPLIER: "Multiplier", PERCENT: "Percent" };

export function PricingItemsTable({ businessId, currency, items, services, save, quickUpdate, archive }: {
  businessId: string;
  currency: string;
  items: PricingItemRow[];
  services: Array<{ id: string; name: string }>;
  save: (businessId: string, itemId: string | null, prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
  quickUpdate: (businessId: string, itemId: string, patch: { amount?: number; unit?: string; isActive?: boolean }) => Promise<ActionResult>;
  archive: (businessId: string, itemId: string) => Promise<ActionResult>;
}) {
  const [editing, setEditing] = React.useState<string | null | "new">(null);
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const groups = [...new Set(items.map((i) => i.category ?? "other"))];
  const fmt = (i: PricingItemRow) => (i.type === "MULTIPLIER" ? `×${i.amount}` : i.type === "PERCENT" ? `${i.amount}%` : `${formatCents(Math.round(i.amount * 100), currency)}${i.unit ? ` / ${i.unit}` : ""}`);
  const editingItem = items.find((i) => i.id === editing) ?? null;
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setEditing("new")}>Add pricing item</Button></div>
      {(editing === "new" || editingItem) && (
        <Card>
          <CardHeader title={editingItem ? `Edit ${editingItem.label}` : "New pricing item"} actions={<Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Close</Button>} />
          <CardBody>
            <ActionForm action={save.bind(null, businessId, editingItem?.id ?? null)} className="grid gap-4 sm:grid-cols-3" successMessage="Saved" onSuccess={() => setEditing(null)}>
              {({ fieldErrors }) => (
                <>
                  <Field label="Label" required error={fieldErrors.label}><Input name="label" defaultValue={editingItem?.label ?? ""} required /></Field>
                  <Field label="Key" required hint="snake_case, used by rules" error={fieldErrors.key}><Input name="key" defaultValue={editingItem?.key ?? ""} required pattern="[a-z0-9_]+" /></Field>
                  <Field label="Type"><Select name="type" defaultValue={editingItem?.type ?? "RATE"}>{(Object.keys(TYPE_LABEL) as PricingItemRow["type"][]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</Select></Field>
                  <Field label="Amount" required error={fieldErrors.amount} hint="Dollars for rates/fees; factor for multipliers; % for percents"><Input name="amount" type="number" step="0.0001" defaultValue={editingItem?.amount ?? 0} required /></Field>
                  <Field label="Unit" hint="m², hour, point, lm…"><Input name="unit" defaultValue={editingItem?.unit ?? ""} /></Field>
                  <Field label="Category"><Input name="category" list="pricing-cat" defaultValue={editingItem?.category ?? "labour"} /><datalist id="pricing-cat">{["labour", "materials", "fees", "preparation", "finish", "complexity", "business"].map((c) => <option key={c} value={c} />)}</datalist></Field>
                  <Field label="Service (optional)"><Select name="serviceId" defaultValue={editingItem?.serviceId ?? ""}><option value="">All services</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
                  <Field label="Description" className="sm:col-span-2"><Textarea name="description" defaultValue={editingItem?.description ?? ""} rows={2} /></Field>
                  <div className="sm:col-span-3 flex items-center gap-4"><Checkbox name="isActive" defaultChecked={editingItem?.isActive ?? true} label="Active" /><SubmitButton>Save item</SubmitButton></div>
                </>
              )}
            </ActionForm>
          </CardBody>
        </Card>
      )}
      {items.length === 0 ? <EmptyState title="No pricing items" description="Add rates, fees, multipliers and percentages. New businesses inherit these from their industry." /> : groups.map((g) => (
        <Card key={g}>
          <CardHeader title={g[0].toUpperCase() + g.slice(1)} />
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500"><tr><th className="px-4 py-2">Item</th><th className="px-4 py-2">Key</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Amount</th><th className="px-4 py-2">Unit</th><th className="px-4 py-2">Active</th><th className="px-4 py-2"></th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {items.filter((i) => (i.category ?? "other") === g).map((i) => (
                <tr key={i.id} className={cn(!i.isActive && "opacity-60")}>
                  <td className="px-4 py-2"><span className="font-medium">{i.label}</span>{i.serviceName && <Badge className="ml-2">{i.serviceName}</Badge>}{i.description && <span className="block text-xs text-neutral-500">{i.description}</span>}</td>
                  <td className="px-4 py-2 font-mono text-xs text-neutral-500">{i.key}</td>
                  <td className="px-4 py-2">{TYPE_LABEL[i.type]}</td>
                  <td className="px-4 py-2"><InlineNumber value={i.amount} display={fmt(i)} onCommit={(v) => start(async () => { await quickUpdate(businessId, i.id, { amount: v }); router.refresh(); })} /></td>
                  <td className="px-4 py-2 text-neutral-500">{i.unit ?? "—"}</td>
                  <td className="px-4 py-2"><input type="checkbox" checked={i.isActive} disabled={pending} onChange={(e) => start(async () => { await quickUpdate(businessId, i.id, { isActive: e.target.checked }); router.refresh(); })} /></td>
                  <td className="px-4 py-2 text-right"><Button variant="ghost" size="sm" onClick={() => setEditing(i.id)}>Edit</Button><Button variant="ghost" size="sm" onClick={() => { if (window.confirm(`Archive "${i.label}"? Rules referencing it will no longer find it.`)) start(async () => { await archive(businessId, i.id); router.refresh(); }); }}>Archive</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}

function InlineNumber({ value, display, onCommit }: { value: number; display: string; onCommit: (v: number) => void }) {
  const [editing, setEditing] = React.useState(false);
  const [v, setV] = React.useState(String(value));
  if (!editing) return <button type="button" className="rounded px-1 hover:bg-neutral-100" title="Click to edit" onClick={() => { setV(String(value)); setEditing(true); }}>{display}</button>;
  return <Input autoFocus type="number" step="0.0001" value={v} className="w-28" onChange={(e) => setV(e.target.value)} onBlur={() => { setEditing(false); const n = Number(v); if (Number.isFinite(n) && n !== value) onCommit(n); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(false); }} />;
}
