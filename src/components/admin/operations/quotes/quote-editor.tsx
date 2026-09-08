"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, ButtonLink, Card, CardBody, CardHeader, Field, Input, Select, Textarea, cn } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { CustomFieldsForm } from "@/components/admin/custom-fields-form";
import { CustomerSelect, type CustomerChoice } from "@/components/admin/operations/jobs/customer-select";
import type { FieldDefinitionView } from "@/lib/custom-fields";
import type { ActionResult } from "@/lib/actions";
import type { TestCalcResult } from "@/lib/pricing/admin";
import { formatCents } from "@/lib/money";

export interface QuoteLine { id: string; description: string; quantity: number; unit: string; unitCents: number; pricingItemKey?: string }
export interface PriceListItem { key: string; label: string; unit: string | null; amountCents: number; category: string | null; type: string }
export interface QuoteEditorValues { quoteId: string | null; customerId: string | null; leadId: string | null; title: string; lines: QuoteLine[]; notes: string; terms: string; validUntil: string; depositPercent: number; inputs: Record<string, unknown> }

const uid = () => `li_${Math.random().toString(36).slice(2, 9)}`;
const toDollars = (c: number) => (c / 100).toFixed(2);
const toCents = (s: string) => Math.round((Number(s) || 0) * 100);

/**
 * Quote builder: customer, title, line items (manual, from the price list or
 * from the pricing calculator), notes/terms, validity and deposit.
 * Line items submit as `lineItems:json`; calculator inputs as `inputs:json`.
 */
export function QuoteEditor({ businessId, values, customers, priceList, services, estimateFields, tax, cancelHref, calculate, save }: {
  businessId: string;
  values: QuoteEditorValues;
  customers: CustomerChoice[];
  priceList: PriceListItem[];
  services: Array<{ id: string; name: string }>;
  estimateFields: FieldDefinitionView[];
  tax: { rate: number; inclusive: boolean; name: string; currency: string };
  cancelHref: string;
  calculate: (businessId: string, serviceId: string | null, inputs: Record<string, unknown>) => Promise<ActionResult<TestCalcResult>>;
  save: (prev: ActionResult<{ id: string }> | undefined, fd: FormData) => Promise<ActionResult<{ id: string }>>;
}) {
  const router = useRouter();
  const [lines, setLines] = React.useState<QuoteLine[]>(values.lines.length ? values.lines : [{ id: uid(), description: "", quantity: 1, unit: "", unitCents: 0 }]);
  const [deposit, setDeposit] = React.useState(values.depositPercent);
  const [inputs, setInputs] = React.useState<Record<string, unknown>>(values.inputs);
  const [calc, setCalc] = React.useState<TestCalcResult | null>(null);
  const [calcError, setCalcError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const [pick, setPick] = React.useState("");
  const calcForm = React.useRef<HTMLFormElement>(null);
  const setLine = (id: string, patch: Partial<QuoteLine>) => setLines((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const subtotalRaw = lines.reduce((s, l) => s + Math.round(l.quantity * l.unitCents), 0);
  const rate = tax.rate / 100;
  const taxCents = tax.inclusive ? Math.round(subtotalRaw - subtotalRaw / (1 + rate)) : Math.round(subtotalRaw * rate);
  const subtotal = tax.inclusive ? subtotalRaw - taxCents : subtotalRaw;
  const total = tax.inclusive ? subtotalRaw : subtotalRaw + taxCents;
  const addFromList = () => {
    const item = priceList.find((p) => p.key === pick);
    if (!item) return;
    setLines((l) => [...l.filter((x) => x.description || x.unitCents), { id: uid(), description: item.label, quantity: 1, unit: item.unit ?? "", unitCents: item.amountCents, pricingItemKey: item.key }]);
    setPick("");
  };
  // The calculator is its own <form> (rendered outside the quote form) so its inputs never block or pollute the save.
  const runCalc = () => {
    const fd = new FormData(calcForm.current!);
    const next: Record<string, unknown> = {};
    let serviceId: string | null = null;
    for (const [k, v] of fd.entries()) {
      if (k === "serviceId") serviceId = String(v) || null;
      else if (k.startsWith("cf.")) { const key = k.slice(3).replace(/\[\]$/, ""); if (k.endsWith("[]")) next[key] = [...((next[key] as unknown[]) ?? []), v]; else next[key] = v === "on" ? true : v; }
    }
    if (serviceId) next.__serviceId = serviceId;
    setInputs(next);
    start(async () => { setCalcError(null); const r = await calculate(businessId, serviceId, next); if (r.ok) setCalc(r.data); else setCalcError(r.error); });
  };
  const applyCalc = (replace: boolean) => {
    if (!calc) return;
    const fresh = calc.lineItems.map((l) => ({ id: uid(), description: l.description, quantity: l.quantity, unit: l.unit ?? "", unitCents: l.unitCents, pricingItemKey: l.pricingItemKey }));
    setLines((l) => (replace ? fresh : [...l.filter((x) => x.description || x.unitCents), ...fresh]));
  };
  const onSuccess = React.useCallback((d: { id: string }) => { router.push(`/admin/${businessId}/quotes/${d.id}`); }, [router, businessId]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
    <ActionForm action={save} onSuccess={onSuccess} refreshOnSuccess={false}>
      {({ fieldErrors }) => (
        <div className="space-y-4">
          <input type="hidden" name="businessId" value={businessId} />
          {values.quoteId && <input type="hidden" name="quoteId" value={values.quoteId} />}
          {values.leadId && <input type="hidden" name="leadId" value={values.leadId} />}
          <input type="hidden" name="lineItems:json" value={JSON.stringify(lines.filter((l) => l.description.trim()).map((l) => ({ id: l.id, description: l.description, quantity: l.quantity, unit: l.unit || undefined, unitCents: l.unitCents, pricingItemKey: l.pricingItemKey })))} />
          <input type="hidden" name="inputs:json" value={JSON.stringify(inputs)} />
          <input type="hidden" name="depositPercent" value={deposit} />
            <Card><CardBody className="grid gap-4 md:grid-cols-2">
              <Field label="Quote title" required error={fieldErrors.title} className="md:col-span-2"><Input name="title" defaultValue={values.title} placeholder="Bathroom renovation — 12 Smith St" /></Field>
              <div className="md:col-span-2"><CustomerSelect customers={customers} value={values.customerId} errors={fieldErrors} /></div>
            </CardBody></Card>

            <Card><CardHeader title="Line items" description={`Prices are ${tax.inclusive ? `inclusive of ${tax.name}` : `exclusive of ${tax.name}`} (${tax.rate}%).`} /><CardBody className="space-y-3">
              {fieldErrors.lineItems && <Alert tone="danger">{fieldErrors.lineItems}</Alert>}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wide text-neutral-500"><th className="py-1 pr-2">Description</th><th className="w-20 py-1 pr-2">Qty</th><th className="w-24 py-1 pr-2">Unit</th><th className="w-32 py-1 pr-2">Unit price</th><th className="w-28 py-1 text-right">Total</th><th className="w-8" /></tr></thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.id} className="align-top">
                        <td className="py-1 pr-2"><Input value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value })} placeholder="Supply and lay 600×600 porcelain" aria-label="Description" /></td>
                        <td className="py-1 pr-2"><Input type="number" step="0.01" min="0" value={l.quantity} onChange={(e) => setLine(l.id, { quantity: Number(e.target.value) })} aria-label="Quantity" /></td>
                        <td className="py-1 pr-2"><Input value={l.unit} onChange={(e) => setLine(l.id, { unit: e.target.value })} placeholder="m²" aria-label="Unit" /></td>
                        <td className="py-1 pr-2"><Input type="number" step="0.01" min="0" value={toDollars(l.unitCents)} onChange={(e) => setLine(l.id, { unitCents: toCents(e.target.value) })} aria-label="Unit price" /></td>
                        <td className="py-2 text-right tabular-nums">{formatCents(Math.round(l.quantity * l.unitCents), tax.currency)}</td>
                        <td className="py-1 text-right"><button type="button" aria-label="Remove line" className="rounded px-1.5 py-1 text-neutral-400 hover:bg-neutral-100 hover:text-red-600" onClick={() => setLines((x) => x.filter((y) => y.id !== l.id))}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setLines((l) => [...l, { id: uid(), description: "", quantity: 1, unit: "", unitCents: 0 }])}>+ Add line</Button>
                {priceList.length > 0 && (
                  <div className="flex items-center gap-1"><Select value={pick} onChange={(e) => setPick(e.target.value)} className="w-auto" aria-label="Price list"><option value="">Add from price list…</option>{priceList.map((p) => <option key={p.key} value={p.key}>{p.label} — {formatCents(p.amountCents, tax.currency)}{p.unit ? `/${p.unit}` : ""}</option>)}</Select><Button type="button" size="sm" variant="secondary" disabled={!pick} onClick={addFromList}>Add</Button></div>
                )}
              </div>
              <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><span className="tabular-nums">{formatCents(subtotal, tax.currency)}</span></div>
                <div className="flex justify-between"><span className="text-neutral-500">{tax.name} ({tax.rate}%)</span><span className="tabular-nums">{formatCents(taxCents, tax.currency)}</span></div>
                <div className="flex justify-between border-t pt-1 text-base font-semibold"><span>Total</span><span className="tabular-nums">{formatCents(total, tax.currency)}</span></div>
                {deposit > 0 && <div className="flex justify-between text-xs text-neutral-500"><span>Deposit ({deposit}%)</span><span className="tabular-nums">{formatCents(Math.round((total * deposit) / 100), tax.currency)}</span></div>}
              </div>
            </CardBody></Card>

            <Card><CardBody className="grid gap-4 md:grid-cols-2">
              <Field label="Notes for the customer" className="md:col-span-2"><Textarea name="notes" rows={3} defaultValue={values.notes} placeholder="Scope, inclusions, timing…" /></Field>
              <Field label="Terms & conditions" className="md:col-span-2"><Textarea name="terms" rows={4} defaultValue={values.terms} /></Field>
              <Field label="Valid until" error={fieldErrors.validUntil}><Input type="date" name="validUntil" defaultValue={values.validUntil} /></Field>
              <Field label="Deposit required (%)"><Input type="number" min={0} max={100} step={1} value={deposit} onChange={(e) => setDeposit(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} /></Field>
            </CardBody></Card>
            <div className="flex gap-2"><SubmitButton>{values.quoteId ? "Save quote" : "Create quote"}</SubmitButton><ButtonLink variant="secondary" href={cancelHref}>Cancel</ButtonLink></div>
          </div>
      )}
    </ActionForm>
          <div className="space-y-4">
            <Card><CardHeader title="Calculator" description="Uses your pricing items and rules. Add the result as line items, then adjust." /><CardBody className="space-y-3">
              <form ref={calcForm} onSubmit={(e) => { e.preventDefault(); runCalc(); }} className="space-y-3">
                <Field label="Service"><Select name="serviceId" defaultValue={String(values.inputs.__serviceId ?? "")}><option value="">Any</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
                {estimateFields.length === 0 ? <p className="text-xs text-neutral-500">No estimate inputs defined yet. Add ESTIMATE custom fields (e.g. area in m²) under Custom fields, and pricing items under Pricing.</p> : <CustomFieldsForm businessId={businessId} definitions={estimateFields} values={inputs} />}
                <Button type="submit" variant="secondary" size="sm" disabled={pending}>{pending ? "Calculating…" : "Calculate"}</Button>
              </form>
              {calcError && <Alert tone="danger">{calcError}</Alert>}
              {calc && (
                <div className="space-y-2 rounded-md border bg-neutral-50 p-3 text-sm">
                  {calc.lineItems.length === 0 ? <p className="text-neutral-500">No line items produced. Check your pricing items match the inputs.</p> : <ul className="space-y-1">{calc.lineItems.map((l, i) => <li key={i} className="flex justify-between gap-2"><span className="truncate">{l.description} <span className="text-xs text-neutral-500">{l.quantity} {l.unit ?? ""}</span></span><span className="tabular-nums">{formatCents(l.totalCents, tax.currency)}</span></li>)}</ul>}
                  <div className="flex justify-between border-t pt-1 font-medium"><span>Total</span><span className="tabular-nums">{formatCents(calc.totalCents, tax.currency)}</span></div>
                  {calc.appliedRules.length > 0 && <p className="text-xs text-neutral-500">Rules: {calc.appliedRules.map((r) => r.name).join(", ")}</p>}
                  <div className="flex gap-2"><Button type="button" size="sm" onClick={() => applyCalc(false)} disabled={calc.lineItems.length === 0}>Add to quote</Button><Button type="button" size="sm" variant="secondary" onClick={() => applyCalc(true)} disabled={calc.lineItems.length === 0}>Replace lines</Button></div>
                </div>
              )}
            </CardBody></Card>
            <p className={cn("text-xs text-neutral-500")}>Totals recalculate on save using the business tax settings.</p>
          </div>
    </div>
  );
}
