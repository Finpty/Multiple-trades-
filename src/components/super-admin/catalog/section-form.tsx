"use client";

import { Card, CardBody, CardHeader } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import type { ActionResult } from "@/lib/actions";

/** Card + form wrapper for JSON-backed editors. Children render a hidden input named "data:json". */
export function SectionForm({ action, title, description, children }: { action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>; title: string; description?: string; children: React.ReactNode }) {
  return (
    <ActionForm action={action} successMessage="Saved" refreshOnSuccess={false}>
      <Card>
        <CardHeader title={title} description={description} actions={<SubmitButton>Save</SubmitButton>} />
        <CardBody>{children}</CardBody>
      </Card>
    </ActionForm>
  );
}
