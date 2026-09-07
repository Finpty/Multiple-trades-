"use client";

import * as React from "react";
import { Alert, Button, Field, Select } from "@/components/ui";
import { CustomFieldsForm } from "@/components/admin/custom-fields-form";
import type { FieldDefinitionView } from "@/lib/custom-fields";
import type { ActionResult } from "@/lib/actions";
import type { TestCalcResult } from "@/lib/pricing/admin";
import { formatCents } from "@/lib/money";

export function PricingTest({ businessId, currency, services, fields, run }: { businessId: string; currency: string; services: Array<{ id: string; name: string }>; fields: FieldDefinitionView[]; run: (businessId: string, serviceId: string | null, inputs: Record<string, unknown>) => Promise<ActionResult<TestCalcResult>> }) {
  const [pending, start] = React.useTransition();
  const [result, setResult] = React.useState<TestCalcResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(formRef.current!);
    const inputs: Record<string, unknown> = {};
    let serviceId: string | null = null;
    for (const [k, v] of fd.entries()) {
      if (k === "serviceId") serviceId = String(v) || null;
      else if (k.startsWith("cf.")) {
        const key = k.slice(3).replace(/\[\]$/, "");
        if (k.endsWith("[]")) inputs[key] = [...((inputs[key] as unknown[]) ?? []), v];
        else inputs[key] = v === "on" ? true : v;
      }
    }
    start(async () => { setError(null); const r = await run(businessId, serviceId, inputs); if (r.ok) setResult(r.data); else setError(r.error); });
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form ref={formRef} onSubmit={submit} className="space-y-4">
        <Field label="Service"><Select name="serviceId"><option value="">Any</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        {fields.length === 0 ? <Alert tone="info">No estimate fields defined. Add ESTIMATE custom fields (e.g. area_sqm) under Custom Fields so the calculator can ask for inputs.</Alert> : <CustomFieldsForm definitions={fields} values={{}} businessId={businessId} />}
        <Button type="submit" disabled={pending}>{pending ? "Calculating…" : "Calculate"}</Button>
      </form>
      <div>
        {error && <Alert tone="danger">{error}</Alert>}
        {result && (
          <div className="space-y-3">
            {result.usedImplicitRules && <Alert tone="info">No active rules: the default behaviour (each rate × matching input) was used.</Alert>}
            <table className="w-full text-sm">
              <tbody className="divide-y divide-neutral-100">
                {result.lineItems.map((l, i) => <tr key={i}><td className="py-1.5">{l.description}<span className="ml-2 text-xs text-neutral-500">{l.quantity} {l.unit ?? ""} × {formatCents(l.unitCents, currency)}</span></td><td className="py-1.5 text-right">{formatCents(l.totalCents, currency)}</td></tr>)}
                <tr><td className="py-1.5 font-medium">Subtotal</td><td className="py-1.5 text-right font-medium">{formatCents(result.subtotalCents, currency)}</td></tr>
                <tr><td className="py-1.5 text-neutral-500">Tax</td><td className="py-1.5 text-right text-neutral-500">{formatCents(result.taxCents, currency)}</td></tr>
                <tr><td className="py-1.5 text-base font-semibold">Total</td><td className="py-1.5 text-right text-base font-semibold">{formatCents(result.totalCents, currency)}</td></tr>
              </tbody>
            </table>
            <details className="text-xs text-neutral-600"><summary className="cursor-pointer">Trace ({result.appliedRules.length} rules applied)</summary><pre className="mt-2 whitespace-pre-wrap rounded bg-neutral-50 p-2">{result.trace.join("\n") || "no actions"}</pre></details>
          </div>
        )}
        {!result && !error && <p className="text-sm text-neutral-500">Enter inputs and calculate to see the line items and the rule trace.</p>}
      </div>
    </div>
  );
}
