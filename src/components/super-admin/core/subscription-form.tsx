"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { Card, CardBody, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";

export interface SubscriptionFormValues {
  id?: string;
  organizationId: string;
  businessId: string | null;
  plan: string;
  status: string;
  seats: number;
  price: string;
  currency: string;
  interval: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string;
  provider: string;
  externalId: string;
  notes: string;
}

export interface OrgOption {
  id: string;
  name: string;
  businesses: Array<{ id: string; name: string }>;
}

type Action<T = undefined> = (prev: ActionResult<T> | undefined, formData: FormData) => Promise<ActionResult<T>>;

export function SubscriptionForm({ action, values, organisations, statuses, intervals, mode }: {
  action: Action<{ id: string }> | Action;
  values: SubscriptionFormValues;
  organisations: OrgOption[];
  statuses: string[];
  intervals: readonly string[];
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [orgId, setOrgId] = React.useState(values.organizationId || organisations[0]?.id || "");
  const businesses = organisations.find((o) => o.id === orgId)?.businesses ?? [];
  const intervalOptions = intervals.includes(values.interval) ? [...intervals] : [values.interval, ...intervals];
  const statusOptions = statuses.includes(values.status) ? statuses : [values.status, ...statuses];

  return (
    <ActionForm
      action={action as Action<{ id: string } | undefined>}
      refreshOnSuccess={mode === "edit"}
      onSuccess={(data) => {
        if (mode === "create" && data && typeof data === "object" && "id" in data) router.push(`/super-admin/subscriptions/${(data as { id: string }).id}`);
      }}
    >
      {({ fieldErrors, pending }) => (
        <fieldset disabled={pending} className="space-y-6">
          {values.id && <input type="hidden" name="subscriptionId" value={values.id} />}
          <Card>
            <CardHeader title="Scope" description="A subscription belongs to an organisation and can optionally be limited to one of its businesses." />
            <CardBody className="grid gap-4 md:grid-cols-2">
              <Field label="Organisation" required error={fieldErrors.organizationId}>
                <Select name="organizationId" value={orgId} onChange={(e) => setOrgId(e.target.value)} required>
                  {organisations.length === 0 && <option value="">No organisations</option>}
                  {organisations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Business" error={fieldErrors.businessId} hint="Leave empty to cover the whole organisation.">
                <Select name="businessId" defaultValue={values.businessId ?? ""} key={orgId}>
                  <option value="">Whole organisation</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Plan & pricing" />
            <CardBody className="grid gap-4 md:grid-cols-3">
              <Field label="Plan name" required error={fieldErrors.plan}>
                <Input name="plan" defaultValue={values.plan} required maxLength={80} placeholder="e.g. Standard" />
              </Field>
              <Field label="Status" required error={fieldErrors.status}>
                <Select name="status" defaultValue={values.status} required>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Seats" required error={fieldErrors.seats}>
                <Input name="seats" type="number" min={1} step={1} defaultValue={values.seats} required />
              </Field>
              <Field label="Price" required error={fieldErrors.price} hint="Per billing interval, before tax.">
                <Input name="price" type="number" min={0} step="0.01" defaultValue={values.price} required />
              </Field>
              <Field label="Currency" required error={fieldErrors.currency}>
                <Input name="currency" defaultValue={values.currency} maxLength={3} required />
              </Field>
              <Field label="Billing interval" required error={fieldErrors.interval}>
                <Select name="interval" defaultValue={values.interval} required>
                  {intervalOptions.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </Select>
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Period & provider" />
            <CardBody className="grid gap-4 md:grid-cols-3">
              <Field label="Current period start" error={fieldErrors.currentPeriodStart}>
                <Input name="currentPeriodStart" type="date" defaultValue={values.currentPeriodStart} />
              </Field>
              <Field label="Current period end" error={fieldErrors.currentPeriodEnd}>
                <Input name="currentPeriodEnd" type="date" defaultValue={values.currentPeriodEnd} />
              </Field>
              <Field label="Trial ends" error={fieldErrors.trialEndsAt}>
                <Input name="trialEndsAt" type="date" defaultValue={values.trialEndsAt} />
              </Field>
              <Field label="Billing provider" error={fieldErrors.provider} hint="e.g. stripe, manual, invoice">
                <Input name="provider" defaultValue={values.provider} maxLength={60} />
              </Field>
              <Field label="External id" error={fieldErrors.externalId} hint="Reference in the billing provider.">
                <Input name="externalId" defaultValue={values.externalId} maxLength={160} />
              </Field>
              <Field label="Notes" error={fieldErrors.notes} className="md:col-span-3">
                <Textarea name="notes" defaultValue={values.notes} maxLength={2000} />
              </Field>
            </CardBody>
          </Card>

          <div className="flex justify-end">
            <SubmitButton pendingText="Saving…">{mode === "create" ? "Create subscription" : "Save subscription"}</SubmitButton>
          </div>
        </fieldset>
      )}
    </ActionForm>
  );
}
