"use client";

import * as React from "react";
import type { ActionResult } from "@/lib/actions";
import type { FieldDefinitionView } from "@/lib/custom-fields";
import { Button, ButtonLink, Card, CardBody, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { CustomFieldsForm } from "@/components/admin/custom-fields-form";

export interface CustomerFormValues {
  firstName: string; lastName: string; email: string; phone: string; company: string;
  address: { line1?: string; line2?: string; suburb?: string; state?: string; postcode?: string; country?: string };
  notes: string; tags: string[]; source: string; status: string;
}

/** Customer create/edit form. Tags are submitted as repeated `tags` inputs. */
export function CustomerForm({ businessId, action, values, definitions, customValues, cancelHref, submitLabel, sources }: {
  businessId: string;
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
  values: CustomerFormValues;
  definitions: FieldDefinitionView[];
  customValues: Record<string, unknown>;
  cancelHref: string;
  submitLabel: string;
  sources: string[];
}) {
  const [tags, setTags] = React.useState<string[]>(values.tags);
  const [tagInput, setTagInput] = React.useState("");
  const addTag = () => { const t = tagInput.trim(); if (t && !tags.includes(t)) setTags([...tags, t]); setTagInput(""); };
  return (
    <ActionForm action={action} refreshOnSuccess>
      {({ fieldErrors }) => (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {tags.map((t) => <input key={t} type="hidden" name="tags[]" value={t} />)}
          <div className="space-y-4">
            <Card><CardHeader title="Contact" /><CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" required error={fieldErrors.firstName}><Input name="firstName" defaultValue={values.firstName} autoFocus /></Field>
              <Field label="Last name" error={fieldErrors.lastName}><Input name="lastName" defaultValue={values.lastName} /></Field>
              <Field label="Email" error={fieldErrors.email}><Input name="email" type="email" defaultValue={values.email} /></Field>
              <Field label="Phone" error={fieldErrors.phone}><Input name="phone" defaultValue={values.phone} /></Field>
              <Field label="Company" error={fieldErrors.company} className="sm:col-span-2"><Input name="company" defaultValue={values.company} /></Field>
            </CardBody></Card>
            <Card><CardHeader title="Address" /><CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Address line 1" className="sm:col-span-2"><Input name="address.line1" defaultValue={values.address.line1 ?? ""} /></Field>
              <Field label="Address line 2" className="sm:col-span-2"><Input name="address.line2" defaultValue={values.address.line2 ?? ""} /></Field>
              <Field label="Suburb"><Input name="address.suburb" defaultValue={values.address.suburb ?? ""} /></Field>
              <Field label="State"><Input name="address.state" defaultValue={values.address.state ?? ""} /></Field>
              <Field label="Postcode"><Input name="address.postcode" defaultValue={values.address.postcode ?? ""} /></Field>
              <Field label="Country"><Input name="address.country" defaultValue={values.address.country ?? ""} /></Field>
            </CardBody></Card>
            <Card><CardHeader title="Notes" /><CardBody><Textarea name="notes" rows={4} defaultValue={values.notes} placeholder="Gate code, parking, preferences…" /></CardBody></Card>
            {definitions.length > 0 && <Card><CardHeader title="Custom fields" /><CardBody><CustomFieldsForm businessId={businessId} definitions={definitions} values={customValues} errors={fieldErrors} /></CardBody></Card>}
          </div>
          <div className="space-y-4">
            <Card><CardHeader title="Details" /><CardBody className="space-y-4">
              <Field label="Status"><Select name="status" defaultValue={values.status}><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option></Select></Field>
              <Field label="Source" hint="Where this customer came from"><Input name="source" list="customer-sources" defaultValue={values.source} /><datalist id="customer-sources">{sources.map((s) => <option key={s} value={s} />)}</datalist></Field>
              <Field label="Tags" hint="Press Enter to add. Used for filtering and automations.">
                <div className="flex gap-2"><Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} placeholder="e.g. repeat, strata" /><Button type="button" variant="secondary" onClick={addTag}>Add</Button></div>
                {tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{tags.map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs">{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}>×</button></span>)}</div>}
              </Field>
            </CardBody></Card>
            <div className="flex gap-2"><SubmitButton>{submitLabel}</SubmitButton><ButtonLink variant="secondary" href={cancelHref}>Cancel</ButtonLink></div>
          </div>
        </div>
      )}
    </ActionForm>
  );
}
