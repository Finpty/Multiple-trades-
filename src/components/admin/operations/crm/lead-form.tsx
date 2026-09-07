"use client";

import type { ActionResult } from "@/lib/actions";
import type { FieldDefinitionView } from "@/lib/custom-fields";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/lib/crm/leads";
import { ButtonLink, Card, CardBody, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { CustomFieldsForm } from "@/components/admin/custom-fields-form";

export interface LeadFormValues {
  name: string;
  email: string;
  phone: string;
  message: string;
  serviceId: string;
  source: string;
  locationText: string;
  valueDollars: string;
  assignedToUserId: string;
  status: string;
}

export function LeadForm({ businessId, action, values, services, members, definitions, customValues, cancelHref, submitLabel, showStatus }: {
  businessId: string;
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
  values: LeadFormValues;
  services: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string }>;
  definitions: FieldDefinitionView[];
  customValues: Record<string, unknown>;
  cancelHref: string;
  submitLabel: string;
  showStatus?: boolean;
}) {
  return (
    <ActionForm action={action} refreshOnSuccess>
      {({ fieldErrors }) => (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card>
              <CardHeader title="Contact" />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" required error={fieldErrors.name} className="sm:col-span-2">
                  <Input name="name" defaultValue={values.name} autoFocus />
                </Field>
                <Field label="Email" error={fieldErrors.email}>
                  <Input name="email" type="email" defaultValue={values.email} />
                </Field>
                <Field label="Phone" error={fieldErrors.phone}>
                  <Input name="phone" type="tel" defaultValue={values.phone} />
                </Field>
                <Field label="Location" hint="Suburb or address of the job" className="sm:col-span-2">
                  <Input name="locationText" defaultValue={values.locationText} />
                </Field>
                <Field label="Message / notes" className="sm:col-span-2" error={fieldErrors.message}>
                  <Textarea name="message" rows={4} defaultValue={values.message} />
                </Field>
              </CardBody>
            </Card>
            {definitions.length > 0 && (
              <Card>
                <CardHeader title="More details" description="Lead fields configured for this business." />
                <CardBody>
                  <CustomFieldsForm definitions={definitions} values={customValues} businessId={businessId} errors={fieldErrors} />
                </CardBody>
              </Card>
            )}
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader title="Qualification" />
              <CardBody className="space-y-4">
                <Field label="Service" error={fieldErrors.serviceId}>
                  <Select name="serviceId" defaultValue={values.serviceId}>
                    <option value="">Not sure yet</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Source">
                  <Select name="source" defaultValue={values.source || "manual"}>
                    {LEAD_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())}
                      </option>
                    ))}
                    {values.source && !LEAD_SOURCES.includes(values.source as (typeof LEAD_SOURCES)[number]) && <option value={values.source}>{values.source}</option>}
                  </Select>
                </Field>
                <Field label="Estimated value" hint="In dollars" error={fieldErrors.valueDollars}>
                  <Input name="valueDollars" type="number" min={0} step="0.01" defaultValue={values.valueDollars} />
                </Field>
                <Field label="Assigned to">
                  <Select name="assignedToUserId" defaultValue={values.assignedToUserId}>
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                {showStatus && (
                  <Field label="Status">
                    <Select name="status" defaultValue={values.status || "NEW"}>
                      {LEAD_STATUSES.filter((s) => s.value !== "ARCHIVED").map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              </CardBody>
            </Card>
            <div className="flex justify-end gap-2">
              <ButtonLink href={cancelHref} variant="ghost">
                Cancel
              </ButtonLink>
              <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
            </div>
          </div>
        </div>
      )}
    </ActionForm>
  );
}
