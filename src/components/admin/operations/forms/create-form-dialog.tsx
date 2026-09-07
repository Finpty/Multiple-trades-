"use client";

import * as React from "react";
import type { ActionResult } from "@/lib/actions";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { FORM_ACTIONS } from "@/lib/forms/builder";

/** "New form" button that reveals an inline create card. */
export function CreateFormDialog({ action }: { action: (prev: ActionResult<{ id: string }> | undefined, formData: FormData) => Promise<ActionResult<{ id: string }>> }) {
  const [open, setOpen] = React.useState(false);
  if (!open) return <Button onClick={() => setOpen(true)}>New form</Button>;
  return (
    <Card className="w-full max-w-md p-4 text-left">
      <ActionForm action={action} refreshOnSuccess={false}>
        {({ fieldErrors }) => (
          <div className="space-y-3">
            <Field label="Form name" required error={fieldErrors.name}>
              <Input name="name" placeholder="e.g. Request a quote" autoFocus />
            </Field>
            <Field label="What happens when it is submitted" hint="You can change this later in Settings.">
              <Select name="action" defaultValue="LEAD">
                {FORM_ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pendingText="Creating…">Create and open builder</SubmitButton>
            </div>
          </div>
        )}
      </ActionForm>
    </Card>
  );
}
