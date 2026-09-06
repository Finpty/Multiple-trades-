"use client";

import * as React from "react";
import type { FieldDefinitionView } from "@/lib/custom-fields";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui";
import { MediaPicker } from "@/components/admin/media-picker";

/**
 * Renders inputs for a set of custom field definitions inside a plain <form>.
 * Inputs are named `cf.<key>` so server actions can collect them with
 * formToObject() → keys starting with "cf.".
 */
export function CustomFieldsForm({ definitions, values, businessId, errors = {}, namePrefix = "cf." }: { definitions: FieldDefinitionView[]; values: Record<string, unknown>; businessId: string; errors?: Record<string, string>; namePrefix?: string }) {
  if (definitions.length === 0) return null;
  const groups = new Map<string, FieldDefinitionView[]>();
  for (const d of definitions) groups.set(d.groupName ?? "", [...(groups.get(d.groupName ?? "") ?? []), d]);
  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([group, defs]) => (
        <div key={group} className="space-y-4">
          {group && <h4 className="text-sm font-semibold text-neutral-700">{group}</h4>}
          <div className="grid gap-4 sm:grid-cols-2">
            {defs.map((d) => (
              <CustomFieldInput key={d.id} def={d} value={values[d.key]} businessId={businessId} name={`${namePrefix}${d.key}`} error={errors[d.key]} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CustomFieldInput({ def: d, value, businessId, name, error }: { def: FieldDefinitionView; value: unknown; businessId: string; name: string; error?: string }) {
  const [media, setMedia] = React.useState<string | null>(typeof value === "string" ? value : null);
  const hint = d.helpText ?? (d.validation.unit ? `Unit: ${d.validation.unit}` : undefined);
  const str = value === undefined || value === null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  switch (d.type) {
    case "TEXTAREA":
    case "RICHTEXT":
      return (
        <Field label={d.label} hint={hint} error={error} required={d.isRequired} className="sm:col-span-2">
          <Textarea name={name} defaultValue={str} required={d.isRequired} />
        </Field>
      );
    case "NUMBER":
    case "MEASUREMENT":
      return (
        <Field label={d.validation.unit ? `${d.label} (${d.validation.unit})` : d.label} hint={d.helpText ?? undefined} error={error} required={d.isRequired}>
          <Input name={name} type="number" step="any" defaultValue={str} required={d.isRequired} min={d.validation.min} max={d.validation.max} />
        </Field>
      );
    case "SELECT":
      return (
        <Field label={d.label} hint={hint} error={error} required={d.isRequired}>
          <Select name={name} defaultValue={str} required={d.isRequired}>
            <option value="">—</option>
            {d.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>
      );
    case "MULTISELECT": {
      const selected = new Set(Array.isArray(value) ? value.map(String) : []);
      return (
        <Field label={d.label} hint={hint} error={error} required={d.isRequired}>
          <div className="flex flex-wrap gap-3">
            {d.options.map((o) => (
              <Checkbox key={o.value} name={`${name}[]`} value={o.value} defaultChecked={selected.has(o.value)} label={o.label} />
            ))}
          </div>
        </Field>
      );
    }
    case "BOOLEAN":
      return (
        <Field label={d.label} hint={hint} error={error}>
          <Checkbox name={name} defaultChecked={value === true || value === "true"} label="Yes" />
        </Field>
      );
    case "DATE":
      return (
        <Field label={d.label} hint={hint} error={error} required={d.isRequired}>
          <Input name={name} type="date" defaultValue={str.slice(0, 10)} required={d.isRequired} />
        </Field>
      );
    case "TIME":
      return (
        <Field label={d.label} hint={hint} error={error} required={d.isRequired}>
          <Input name={name} type="time" defaultValue={str} required={d.isRequired} />
        </Field>
      );
    case "EMAIL":
      return (
        <Field label={d.label} hint={hint} error={error} required={d.isRequired}>
          <Input name={name} type="email" defaultValue={str} required={d.isRequired} />
        </Field>
      );
    case "PHONE":
      return (
        <Field label={d.label} hint={hint} error={error} required={d.isRequired}>
          <Input name={name} type="tel" defaultValue={str} required={d.isRequired} />
        </Field>
      );
    case "URL":
      return (
        <Field label={d.label} hint={hint} error={error} required={d.isRequired}>
          <Input name={name} type="url" defaultValue={str} required={d.isRequired} />
        </Field>
      );
    case "MEDIA":
      return (
        <Field label={d.label} hint={hint} error={error} required={d.isRequired}>
          <MediaPicker businessId={businessId} value={media} onChange={(m) => setMedia(m?.id ?? null)} name={name} kind="ANY" />
        </Field>
      );
    case "ADDRESS":
      return (
        <Field label={d.label} hint={hint} error={error} required={d.isRequired} className="sm:col-span-2">
          <Input name={name} defaultValue={typeof value === "object" && value ? Object.values(value as Record<string, string>).filter(Boolean).join(", ") : str} placeholder="Street, suburb, state, postcode" required={d.isRequired} />
        </Field>
      );
    default:
      return (
        <Field label={d.label} hint={hint} error={error} required={d.isRequired}>
          <Input name={name} defaultValue={str} required={d.isRequired} />
        </Field>
      );
  }
}
