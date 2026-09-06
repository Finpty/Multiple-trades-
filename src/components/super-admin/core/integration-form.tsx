"use client";

import { useRouter } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { Card, CardBody, CardHeader, Field, Input, Switch, Textarea } from "@/components/ui";
import { SecretPairsEditor, type SecretPairRow } from "./secret-pairs-editor";
import type { ActionResult } from "@/lib/actions";

export interface IntegrationFormValues {
  id?: string;
  provider: string;
  name: string;
  config: string;
  isEnabled: boolean;
  status: string;
  secrets: SecretPairRow[];
}

type Action<T = undefined> = (prev: ActionResult<T> | undefined, formData: FormData) => Promise<ActionResult<T>>;

export function IntegrationForm({ action, values, mode }: { action: Action<{ id: string }> | Action; values: IntegrationFormValues; mode: "create" | "edit" }) {
  const router = useRouter();
  return (
    <ActionForm
      action={action as Action<{ id: string } | undefined>}
      refreshOnSuccess={mode === "edit"}
      onSuccess={(data) => {
        if (mode === "create" && data && typeof data === "object" && "id" in data) router.push(`/super-admin/integrations/${(data as { id: string }).id}`);
      }}
    >
      {({ fieldErrors, pending }) => (
        <fieldset disabled={pending} className="space-y-6">
          {values.id && <input type="hidden" name="integrationId" value={values.id} />}
          <Card>
            <CardHeader title="Integration" description="A provider key identifies the service; the name is what staff see." />
            <CardBody className="grid gap-4 md:grid-cols-2">
              <Field label="Provider key" required error={fieldErrors.provider} hint="Lowercase identifier, e.g. stripe, sendgrid, twilio, google-maps.">
                <Input name="provider" defaultValue={values.provider} required maxLength={60} pattern="[a-z0-9][a-z0-9_.-]*" autoComplete="off" />
              </Field>
              <Field label="Display name" required error={fieldErrors.name}>
                <Input name="name" defaultValue={values.name} required maxLength={120} />
              </Field>
              <Field label="Status label" error={fieldErrors.status} hint="Optional free text such as connected, pending, error.">
                <Input name="status" defaultValue={values.status} maxLength={40} />
              </Field>
              <div className="md:col-span-2">
                <Switch name="isEnabled" checked={values.isEnabled} label="Enabled" description="Disabled integrations keep their configuration but are ignored by the platform." />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Configuration" description="Non-secret settings as a JSON object. Secrets belong in the section below, never here." />
            <CardBody>
              <Field label="Config (JSON)" error={fieldErrors.config}>
                <Textarea name="config" defaultValue={values.config} rows={8} className="font-mono text-xs" spellCheck={false} />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Secrets" description="Encrypted at rest with AES-256-GCM. Values are only ever shown masked." />
            <CardBody>
              <SecretPairsEditor initial={values.secrets} />
            </CardBody>
          </Card>

          <div className="flex justify-end">
            <SubmitButton pendingText="Saving…">{mode === "create" ? "Create integration" : "Save integration"}</SubmitButton>
          </div>
        </fieldset>
      )}
    </ActionForm>
  );
}
