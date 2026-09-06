"use client";

import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { Card, CardBody, CardHeader, Field, Input, Select, Switch, Textarea } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";

export type SettingFieldSpec =
  | { kind: "text" | "email" | "number"; name: string; label: string; value: string; hint?: string; required?: boolean; placeholder?: string; min?: number; max?: number; step?: number }
  | { kind: "textarea"; name: string; label: string; value: string; hint?: string; required?: boolean; rows?: number }
  | { kind: "switch"; name: string; label: string; checked: boolean; description?: string }
  | { kind: "select"; name: string; label: string; value: string; options: Array<{ value: string; label: string }>; hint?: string }
  | { kind: "secret"; name: string; label: string; masked: string; hint?: string };

/**
 * Renders one group of platform settings as a form bound to a server action.
 * Field specs are plain data so the page decides what each group contains.
 */
export function SettingsGroupForm({ title, description, fields, action, columns = 2 }: {
  title: string;
  description?: string;
  fields: SettingFieldSpec[];
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
  columns?: 1 | 2 | 3;
}) {
  const grid = columns === 1 ? "grid gap-4" : columns === 3 ? "grid gap-4 md:grid-cols-3" : "grid gap-4 md:grid-cols-2";
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <ActionForm action={action}>
        {({ fieldErrors, pending }) => (
          <fieldset disabled={pending}>
            <CardBody className={grid}>
              {fields.map((f) => {
                const error = fieldErrors[f.name];
                switch (f.kind) {
                  case "switch":
                    return (
                      <div key={f.name} className="md:col-span-2">
                        <Switch name={f.name} checked={f.checked} label={f.label} description={f.description} />
                        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
                      </div>
                    );
                  case "textarea":
                    return (
                      <Field key={f.name} label={f.label} hint={f.hint} error={error} required={f.required} className="md:col-span-2">
                        <Textarea name={f.name} defaultValue={f.value} rows={f.rows ?? 3} required={f.required} />
                      </Field>
                    );
                  case "select":
                    return (
                      <Field key={f.name} label={f.label} hint={f.hint} error={error}>
                        <Select name={f.name} defaultValue={f.value}>
                          {f.options.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    );
                  case "secret":
                    return (
                      <Field key={f.name} label={f.label} hint={f.hint ?? (f.masked ? `Stored: ${f.masked}. Leave blank to keep it, or enter a new value to replace it.` : "Not set.")} error={error}>
                        <Input name={f.name} type="password" autoComplete="new-password" placeholder={f.masked ? "Leave blank to keep" : "Enter value"} />
                      </Field>
                    );
                  default:
                    return (
                      <Field key={f.name} label={f.label} hint={f.hint} error={error} required={f.required}>
                        <Input name={f.name} type={f.kind} defaultValue={f.value} required={f.required} placeholder={f.placeholder} min={f.min} max={f.max} step={f.step} />
                      </Field>
                    );
                }
              })}
            </CardBody>
            <div className="flex justify-end border-t border-neutral-200 px-5 py-3">
              <SubmitButton pendingText="Saving…">Save {title.toLowerCase()}</SubmitButton>
            </div>
          </fieldset>
        )}
      </ActionForm>
    </Card>
  );
}
