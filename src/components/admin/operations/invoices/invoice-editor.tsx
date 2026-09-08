"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, ButtonLink, Card, CardBody, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { CustomerSelect, type CustomerChoice } from "@/components/admin/operations/jobs/customer-select";
import type { ActionResult } from "@/lib/actions";
import { formatCents } from "@/lib/money";

export interface InvoiceLine { id: string; description: string; quantity: number; unit: string; unitCents: number }
export interface InvoiceEditorValues { invoiceId: string | null; customerId: string | null; jobId: string | null; quoteId: string | null; lines: InvoiceLine[]; notes: string; dueAt: string }
export interface PriceListItem { key: string; label: string; unit: string | null; amountCents: number }

const uid = () => `li_${Math.random().toString(36).slice(2, 9)}`;
const toDollars = (c: number) => (c / 100).toFixed(2);
const toCents = (s: string) => Math.round((Number(s) || 0) * 100);

/** Invoice builder: customer, optional job/quote link, line items, due date and notes. Line items submit as `lineItems:json`. */
export function InvoiceEditor({ businessId, values, customers, jobs, quotes, priceList, tax, cancelHref, save }: {
  businessId: string;
  values: InvoiceEditorValues;
  customers: CustomerChoice[];
  jobs: Array<{ id: string; label: string }>;
  quotes: Array<{ id: string; label: string }>;
  priceList: PriceListItem[];
  tax: { rate: number; inclusive: boolean; name: string; currency: string };
  cancelHref: string;
  save: (prev: ActionResult<{ id: string }> | undefined, fd: FormData) => Promise<ActionResult<{ id: string }>>;
}) {
  const router = useRouter();
  const [lines, setLines] = React.useState<InvoiceLine[]>(values.lines.length ? values.lines : [{ id: uid(), description: "", quantity: 1, unit: "", unitCents: 0 }]);
  const [pick, setPick] = React.useState("");
  const setLine = (id: string, patch: Partial<InvoiceLine>) => setLines((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const raw = lines.reduce((s, l) => s + Math.round(l.quantity * l.unitCents), 0);
  const rate = tax.rate / 100;
  const taxCents = tax.inclusive ? Math.round(raw - raw / (1 + rate)) : Math.round(raw * rate);
  const subtotal = tax.inclusive ? raw - taxCents : raw;
  const total = tax.inclusive ? raw : raw + taxCents;
  const onSuccess = React.useCallback((d: { id: string }) => router.push(`/admin/${businessId}/invoices/${d.id}`), [router, businessId]);
  return (
    <ActionForm action={save} onSuccess={onSuccess} refreshOnSuccess={false}>
      {({ fieldErrors }) => (
        <div className="space-y-4">
          <input type="hidden" name="businessId" value={businessId} />
          {values.invoiceId && <input type="hidden" name="invoiceId" value={values.invoiceId} />}
          <input type="hidden" name="lineItems:json" value={JSON.stringify(lines.filter((l) => l.description.trim()).map((l) => ({ id: l.id, description: l.description, quantity: l.quantity, unit: l.unit || undefined, unitCents: l.unitCents })))} />
          <Card><CardBody className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><CustomerSelect customers={customers} value={values.customerId} errors={fieldErrors} /></div>
            <Field label="Job (optional)"><Select name="jobId" defaultValue={values.jobId ?? ""}><option value="">None</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}</Select></Field>
            <Field label="Quote (optional)"><Select name="quoteId" defaultValue={values.quoteId ?? ""}><option value="">None</option>{quotes.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}</Select></Field>
            <Field label="Due date" error={fieldErrors.dueAt}><Input type="date" name="dueAt" defaultValue={values.dueAt} /></Field>
          </CardBody></Card>
          <Card><CardHeader title="Line items" description={`Prices are ${tax.inclusive ? `inclusive of ${tax.name}` : `exclusive of ${tax.name}`} (${tax.rate}%).`} /><CardBody className="space-y-3">
            {fieldErrors.lineItems && <Alert tone="danger">{fieldErrors.lineItems}</Alert>}
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-neutral-500"><th className="py-1 pr-2">Description</th><th className="w-20 py-1 pr-2">Qty</th><th className="w-24 py-1 pr-2">Unit</th><th className="w-32 py-1 pr-2">Unit price</th><th className="w-28 py-1 text-right">Total</th><th className="w-8" /></tr></thead>
              <tbody>{lines.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="py-1 pr-2"><Input value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value })} aria-label="Description" /></td>
                  <td className="py-1 pr-2"><Input type="number" step="0.01" min="0" value={l.quantity} onChange={(e) => setLine(l.id, { quantity: Number(e.target.value) })} aria-label="Quantity" /></td>
                  <td className="py-1 pr-2"><Input value={l.unit} onChange={(e) => setLine(l.id, { unit: e.target.value })} aria-label="Unit" /></td>
                  <td className="py-1 pr-2"><Input type="number" step="0.01" min="0" value={toDollars(l.unitCents)} onChange={(e) => setLine(l.id, { unitCents: toCents(e.target.value) })} aria-label="Unit price" /></td>
                  <td className="py-2 text-right tabular-nums">{formatCents(Math.round(l.quantity * l.unitCents), tax.currency)}</td>
                  <td className="py-1 text-right"><button type="button" aria-label="Remove line" className="rounded px-1.5 py-1 text-neutral-400 hover:bg-neutral-100 hover:text-red-600" onClick={() => setLines((x) => x.filter((y) => y.id !== l.id))}>✕</button></td>
                </tr>
              ))}</tbody>
            </table></div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setLines((l) => [...l, { id: uid(), description: "", quantity: 1, unit: "", unitCents: 0 }])}>+ Add line</Button>
              {priceList.length > 0 && <div className="flex items-center gap-1"><Select value={pick} onChange={(e) => setPick(e.target.value)} className="w-auto" aria-label="Price list"><option value="">Add from price list…</option>{priceList.map((p) => <option key={p.key} value={p.key}>{p.label} — {formatCents(p.amountCents, tax.currency)}{p.unit ? `/${p.unit}` : ""}</option>)}</Select><Button type="button" size="sm" variant="secondary" disabled={!pick} onClick={() => { const it = priceList.find((p) => p.key === pick); if (it) setLines((l) => [...l.filter((x) => x.description || x.unitCents), { id: uid(), description: it.label, quantity: 1, unit: it.unit ?? "", unitCents: it.amountCents }]); setPick(""); }}>Add</Button></div>}
            </div>
            <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><span className="tabular-nums">{formatCents(subtotal, tax.currency)}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">{tax.name} ({tax.rate}%)</span><span className="tabular-nums">{formatCents(taxCents, tax.currency)}</span></div>
              <div className="flex justify-between border-t pt-1 text-base font-semibold"><span>Total</span><span className="tabular-nums">{formatCents(total, tax.currency)}</span></div>
            </div>
          </CardBody></Card>
          <Card><CardBody><Field label="Notes / payment instructions shown on the invoice"><Textarea name="notes" rows={3} defaultValue={values.notes} placeholder="Bank: … BSB … Account … Please use the invoice number as reference." /></Field></CardBody></Card>
          <div className="flex gap-2"><SubmitButton>{values.invoiceId ? "Save invoice" : "Create invoice"}</SubmitButton><ButtonLink variant="secondary" href={cancelHref}>Cancel</ButtonLink></div>
        </div>
      )}
    </ActionForm>
  );
}
