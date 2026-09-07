"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardBody, CardHeader, Checkbox, EmptyState, Field, Input, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { CustomFieldsForm } from "@/components/admin/custom-fields-form";
import { FIELD_TYPE_LABELS, type FieldDefinitionView } from "@/lib/custom-fields";
import type { ActionResult } from "@/lib/actions";

export function CustomFieldsManager({ businessId, entityType, definitions, usage, save, reorder, archive }: {
  businessId: string;
  entityType: string;
  definitions: FieldDefinitionView[];
  usage: Record<string, number>;
  save: (businessId: string, definitionId: string | null, prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
  reorder: (businessId: string, ids: string[]) => Promise<ActionResult>;
  archive: (businessId: string, definitionId: string) => Promise<ActionResult>;
}) {
  const [editing, setEditing] = React.useState<string | null | "new">(null);
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const current = definitions.find((d) => d.id === editing) ?? null;
  const move = (i: number, to: number) => {
    if (to < 0 || to >= definitions.length) return;
    const ids = definitions.map((d) => d.id);
    const [x] = ids.splice(i, 1);
    ids.splice(to, 0, x);
    start(async () => { await reorder(businessId, ids); router.refresh(); });
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="flex justify-end"><Button onClick={() => setEditing("new")}>Add field</Button></div>
        {(editing === "new" || current) && (
          <Card>
            <CardHeader title={current ? `Edit ${current.label}` : "New field"} actions={<Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Close</Button>} />
            <CardBody><DefinitionForm key={current?.id ?? "new"} businessId={businessId} entityType={entityType} initial={current} action={save.bind(null, businessId, current?.id ?? null)} onDone={() => setEditing(null)} /></CardBody>
          </Card>
        )}
        {definitions.length === 0 ? <EmptyState title="No fields yet" description="Add a field to capture trade-specific information." action={<Button onClick={() => setEditing("new")}>Add field</Button>} /> : (
          <Card>
            <ul className="divide-y divide-neutral-100">
              {definitions.map((d, i) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <div className="flex flex-col"><button type="button" className="text-xs text-neutral-400 hover:text-neutral-900" disabled={i === 0 || pending} onClick={() => move(i, i - 1)}>▲</button><button type="button" className="text-xs text-neutral-400 hover:text-neutral-900" disabled={i === definitions.length - 1 || pending} onClick={() => move(i, i + 1)}>▼</button></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{d.label}</span><code className="text-xs text-neutral-500">{d.key}</code><Badge>{FIELD_TYPE_LABELS[d.type]}</Badge>{d.isRequired && <Badge tone="amber">required</Badge>}{d.showOnForms && <Badge tone="blue">on forms</Badge>}{!(definitions.find((x) => x.id === d.id)) && null}</div>
                    <div className="text-xs text-neutral-500">{d.groupName ? `${d.groupName} · ` : ""}{usage[d.id] ?? 0} value(s) stored{d.helpText ? ` · ${d.helpText}` : ""}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(d.id)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (window.confirm(`Archive "${d.label}"? Stored values are kept.`)) start(async () => { await archive(businessId, d.id); router.refresh(); }); }}>Archive</Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      <Card className="self-start">
        <CardHeader title="Preview" description="How these fields render on forms." />
        <CardBody>{definitions.length ? <CustomFieldsForm definitions={definitions} values={{}} businessId={businessId} /> : <p className="text-sm text-neutral-500">Nothing to preview yet.</p>}</CardBody>
      </Card>
    </div>
  );
}

function DefinitionForm({ businessId, entityType, initial, action, onDone }: { businessId: string; entityType: string; initial: FieldDefinitionView | null; action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>; onDone: () => void }) {
  const [type, setType] = React.useState(initial?.type ?? "TEXT");
  const [options, setOptions] = React.useState(initial?.options ?? []);
  const [label, setLabel] = React.useState(initial?.label ?? "");
  const [key, setKey] = React.useState(initial?.key ?? "");
  const snake = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
  void businessId;
  return (
    <ActionForm action={action} className="space-y-4" successMessage="Field saved" onSuccess={onDone}>
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="entityType" value={entityType} />
          <input type="hidden" name="options:json" value={JSON.stringify(options)} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Label" required error={fieldErrors.label}><Input name="label" value={label} onChange={(e) => { setLabel(e.target.value); if (!initial) setKey(snake(e.target.value)); }} required /></Field>
            <Field label="Key" required hint="snake_case" error={fieldErrors.key}><Input name="key" value={key} onChange={(e) => setKey(snake(e.target.value))} required /></Field>
            <Field label="Type"><Select name="type" value={type} onChange={(e) => setType(e.target.value as FieldDefinitionView["type"])}>{(Object.keys(FIELD_TYPE_LABELS) as Array<keyof typeof FIELD_TYPE_LABELS>).map((t) => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}</Select></Field>
            <Field label="Group"><Input name="groupName" defaultValue={initial?.groupName ?? ""} /></Field>
            <Field label="Help text" className="sm:col-span-2"><Input name="helpText" defaultValue={initial?.helpText ?? ""} /></Field>
            {(type === "NUMBER" || type === "MEASUREMENT") && (<><Field label="Unit"><Input name="unit" defaultValue={initial?.validation.unit ?? ""} placeholder="m²" /></Field><Field label="Min"><Input name="min" type="number" step="any" defaultValue={initial?.validation.min ?? ""} /></Field><Field label="Max"><Input name="max" type="number" step="any" defaultValue={initial?.validation.max ?? ""} /></Field></>)}
            <Field label="Default value"><Input name="defaultValue" defaultValue={typeof initial?.defaultValue === "string" ? initial.defaultValue : ""} /></Field>
          </div>
          {(type === "SELECT" || type === "MULTISELECT") && (
            <div>
              <div className="mb-1 text-sm font-medium">Options</div>
              {options.map((o, i) => (
                <div key={i} className="mb-1 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Input value={o.label} placeholder="Label" onChange={(e) => setOptions(options.map((x, j) => (j === i ? { label: e.target.value, value: x.value || snake(e.target.value) } : x)))} />
                  <Input value={o.value} placeholder="value" onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, value: snake(e.target.value) } : x)))} />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setOptions(options.filter((_, j) => j !== i))}>✕</Button>
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={() => setOptions([...options, { label: "", value: "" }])}>+ Option</Button>
            </div>
          )}
          <div className="flex flex-wrap gap-6"><Checkbox name="isRequired" defaultChecked={initial?.isRequired ?? false} label="Required" /><Checkbox name="showOnForms" defaultChecked={initial?.showOnForms ?? false} label="Ask on website forms" /><Checkbox name="isActive" defaultChecked={initial ? initial.sortOrder >= 0 : true} label="Active" /></div>
          <Textarea className="hidden" name="_" />
          <SubmitButton>Save field</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
