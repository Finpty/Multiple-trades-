"use client";

import * as React from "react";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { Button, Card, CardBody, CardHeader, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { ConditionsEditor } from "@/components/admin/conditions-editor";
import { PRICING_ACTION_TYPES, type PricingAction } from "@/lib/pricing/engine";
import type { ConditionGroup } from "@/lib/rules/conditions";
import type { ActionResult } from "@/lib/actions";

type Act = (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
type Item = { key: string; label: string; type: string };
type ActionRow = Record<string, unknown> & { type: PricingAction["type"] };

export function PricingRuleForm({ action, initial, items, services, fields }: { action: Act; initial?: { name: string; description: string; priority: number; serviceId: string | null; conditions: ConditionGroup; actions: ActionRow[]; isActive: boolean }; items: Item[]; services: Array<{ id: string; name: string }>; fields: Array<{ key: string; label: string }> }) {
  const [actions, setActions] = React.useState<ActionRow[]>(initial?.actions?.length ? initial.actions : [{ type: "add_line_item", description: "", inputKey: fields[0]?.key ?? "", pricingItemKey: items[0]?.key ?? "" }]);
  const fieldOptions = [
    ...fields.map((f) => ({ value: `inputs.${f.key}`, label: f.label, group: "Estimate inputs" })),
    ...(fields.some((f) => f.key === "area_sqm") ? [] : [{ value: "inputs.area_sqm", label: "Area (m²) [generic]", group: "Estimate inputs" }]),
    { value: "service.slug", label: "Service slug", group: "Service" },
    { value: "variables.labour", label: "Labour subtotal ($)", group: "Variables" },
    { value: "variables.materials", label: "Materials subtotal ($)", group: "Variables" },
    { value: "variables.fees", label: "Fees subtotal ($)", group: "Variables" },
  ];
  const update = (i: number, patch: Partial<ActionRow>) => setActions(actions.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const variables = ["labour", "materials", "fees"];
  return (
    <ActionForm action={action} className="space-y-6" successMessage="Rule saved">
      {({ fieldErrors }) => (
        <>
          <Card>
            <CardHeader title="Rule" />
            <CardBody className="grid gap-4 sm:grid-cols-3">
              <Field label="Name" required error={fieldErrors.name} className="sm:col-span-2"><Input name="name" defaultValue={initial?.name ?? ""} required placeholder="e.g. Large-format tile multiplier" /></Field>
              <Field label="Priority" hint="Lower runs first" error={fieldErrors.priority}><Input name="priority" type="number" defaultValue={initial?.priority ?? 100} /></Field>
              <Field label="Description" className="sm:col-span-2"><Textarea name="description" rows={2} defaultValue={initial?.description ?? ""} /></Field>
              <Field label="Applies to service"><Select name="serviceId" defaultValue={initial?.serviceId ?? ""}><option value="">All services</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
              <div className="sm:col-span-3"><Checkbox name="isActive" defaultChecked={initial?.isActive ?? true} label="Active" /></div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="IF" description="Conditions evaluated against the calculator inputs. Leave empty for a rule that always applies." />
            <CardBody><ConditionsEditor name="conditions:json" value={initial?.conditions ?? {}} fieldOptions={fieldOptions} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="THEN" description="Actions run in order." actions={<Button type="button" variant="secondary" size="sm" onClick={() => setActions([...actions, { type: "add_fee", description: "", pricingItemKey: items[0]?.key ?? "" }])}>+ Add action</Button>} />
            <CardBody className="space-y-3">
              <input type="hidden" name="actions:json" value={JSON.stringify(actions)} />
              {fieldErrors.actions && <p className="text-sm text-red-600">{fieldErrors.actions}</p>}
              {actions.map((a, i) => {
                const meta = PRICING_ACTION_TYPES.find((t) => t.type === a.type);
                const itemSelect = (key: string, label = "Pricing item") => (
                  <Field label={label}><Select value={String(a[key] ?? "")} onChange={(e) => update(i, { [key]: e.target.value })}><option value="">—</option>{items.map((it) => <option key={it.key} value={it.key}>{it.label} ({it.type.toLowerCase()})</option>)}</Select></Field>
                );
                const variableInput = (
                  <Field label="Variable"><Input list="rule-variables" value={String(a.variable ?? "")} onChange={(e) => update(i, { variable: e.target.value })} placeholder="labour" /></Field>
                );
                return (
                  <div key={i} className="rounded-lg border border-neutral-200 p-3">
                    <div className="grid gap-3 sm:grid-cols-[220px_1fr_auto]">
                      <Field label="Action"><Select value={a.type} onChange={(e) => update(i, { type: e.target.value as PricingAction["type"] })}>{PRICING_ACTION_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}</Select></Field>
                      <p className="self-end pb-2 text-xs text-neutral-500">{meta?.description}</p>
                      <Button type="button" variant="ghost" size="sm" className="self-end" onClick={() => setActions(actions.filter((_, j) => j !== i))}>Remove</Button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {a.type === "add_line_item" && (<>
                        <Field label="Description"><Input value={String(a.description ?? "")} onChange={(e) => update(i, { description: e.target.value })} /></Field>
                        <Field label="Quantity from input"><Select value={String(a.inputKey ?? "")} onChange={(e) => update(i, { inputKey: e.target.value })}><option value="">Fixed quantity 1</option>{fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}<option value="area_sqm">area_sqm</option><option value="hours">hours</option></Select></Field>
                        {itemSelect("pricingItemKey", "Rate (pricing item)")}
                        <Field label="Category"><Input value={String(a.category ?? "")} onChange={(e) => update(i, { category: e.target.value })} placeholder="labour" /></Field>
                      </>)}
                      {a.type === "add_fee" && (<><Field label="Description"><Input value={String(a.description ?? "")} onChange={(e) => update(i, { description: e.target.value })} /></Field>{itemSelect("pricingItemKey", "Fee (pricing item)")}<Field label="…or fixed amount ($)"><Input type="number" step="0.01" value={a.amountCents ? Number(a.amountCents) / 100 : ""} onChange={(e) => update(i, { amountCents: e.target.value === "" ? undefined : Math.round(Number(e.target.value) * 100) })} /></Field></>)}
                      {a.type === "add_percent" && (<><Field label="Description"><Input value={String(a.description ?? "")} onChange={(e) => update(i, { description: e.target.value })} /></Field>{itemSelect("pricingItemKey", "Percent (pricing item)")}<Field label="…or fixed %"><Input type="number" step="0.01" value={String(a.percent ?? "")} onChange={(e) => update(i, { percent: e.target.value === "" ? undefined : Number(e.target.value) })} /></Field><Field label="Of"><Select value={String(a.of ?? "subtotal")} onChange={(e) => update(i, { of: e.target.value })}><option value="subtotal">Subtotal</option><option value="labour">Labour</option><option value="materials">Materials</option></Select></Field></>)}
                      {a.type === "multiply_variable" && (<>{variableInput}{itemSelect("pricingItemKey", "Multiplier (pricing item)")}<Field label="…or fixed factor"><Input type="number" step="0.01" value={String(a.factor ?? "")} onChange={(e) => update(i, { factor: e.target.value === "" ? undefined : Number(e.target.value) })} /></Field></>)}
                      {a.type === "add_to_variable" && (<>{variableInput}{itemSelect("pricingItemKey", "Amount (pricing item)")}<Field label="…or fixed amount"><Input type="number" step="0.01" value={String(a.amount ?? "")} onChange={(e) => update(i, { amount: e.target.value === "" ? undefined : Number(e.target.value) })} /></Field></>)}
                      {a.type === "set_variable" && (<>{variableInput}<Field label="Value"><Input type="number" step="0.01" value={String(a.value ?? "")} onChange={(e) => update(i, { value: Number(e.target.value) })} /></Field></>)}
                      {a.type === "set_from_item" && (<>{variableInput}{itemSelect("pricingItemKey")}</>)}
                      {a.type === "set_minimum" && (<>{itemSelect("pricingItemKey", "Minimum (pricing item)")}<Field label="…or fixed amount ($)"><Input type="number" step="0.01" value={a.amountCents ? Number(a.amountCents) / 100 : ""} onChange={(e) => update(i, { amountCents: e.target.value === "" ? undefined : Math.round(Number(e.target.value) * 100) })} /></Field></>)}
                    </div>
                  </div>
                );
              })}
              <datalist id="rule-variables">{variables.map((v) => <option key={v} value={v} />)}</datalist>
            </CardBody>
          </Card>
          <SubmitButton>Save rule</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
