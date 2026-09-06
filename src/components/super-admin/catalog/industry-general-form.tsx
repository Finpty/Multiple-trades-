"use client";

import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { Checkbox, Field, Input, Textarea } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";
import { IconPicker } from "./icon-picker";

export interface IndustryGeneralInitial {
  name: string;
  slug: string;
  description: string;
  icon: string;
  isActive: boolean;
  sortOrder: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAction = (prev: any, formData: FormData) => Promise<ActionResult<any>>;

export function IndustryGeneralForm({ action, submitLabel, initial }: { action: AnyAction; submitLabel: string; initial?: IndustryGeneralInitial }) {
  return (
    <ActionForm action={action as never} className="space-y-4" successMessage="Saved">
      {({ fieldErrors }) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required error={fieldErrors.name}><Input name="name" defaultValue={initial?.name ?? ""} required placeholder="e.g. Mechanics" /></Field>
            <Field label="Slug" hint="Used in URLs and exports. Leave blank to generate." error={fieldErrors.slug}><Input name="slug" defaultValue={initial?.slug ?? ""} placeholder="mechanics" /></Field>
          </div>
          <Field label="Description" error={fieldErrors.description}><Textarea name="description" defaultValue={initial?.description ?? ""} placeholder="What this trade does, shown when choosing a business type." /></Field>
          <Field label="Icon"><IconPicker name="icon" value={initial?.icon ?? "Wrench"} /></Field>
          <div className="flex items-center gap-6">
            <Checkbox name="isActive" defaultChecked={initial?.isActive ?? true} label="Active (available when creating businesses)" />
            <Field label="Sort order" className="w-32"><Input name="sortOrder" type="number" defaultValue={initial?.sortOrder ?? 0} /></Field>
          </div>
          <SubmitButton>{submitLabel}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
