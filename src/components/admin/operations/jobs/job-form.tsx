"use client";

import { useRouter } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { ButtonLink, Card, CardBody, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { CustomFieldsForm } from "@/components/admin/custom-fields-form";
import type { FieldDefinitionView } from "@/lib/custom-fields";
import type { ActionResult } from "@/lib/actions";
import { CustomerSelect, type CustomerChoice } from "./customer-select";

export interface JobFormOption {
  id: string;
  label: string;
}

export interface JobFormValues {
  id?: string;
  title: string;
  description: string;
  workflowId: string;
  customerId: string | null;
  quoteId: string | null;
  projectId: string | null;
  priority: number;
  scheduledStart: string;
  scheduledEnd: string;
  address: { line1?: string; suburb?: string; state?: string; postcode?: string };
  assignedToUserId: string | null;
  value: string;
}

export function JobForm({ businessId, action, values, workflows, customers, quotes, projects, members, priorities, fieldDefs, fieldValues, cancelHref, submitLabel }: {
  businessId: string;
  action: (prev: ActionResult<{ id: string }> | undefined, fd: FormData) => Promise<ActionResult<{ id: string }>>;
  values: JobFormValues;
  workflows: JobFormOption[];
  customers: CustomerChoice[];
  quotes: JobFormOption[];
  projects: JobFormOption[];
  members: JobFormOption[];
  priorities: Array<{ value: number; label: string }>;
  fieldDefs: FieldDefinitionView[];
  fieldValues: Record<string, unknown>;
  cancelHref: string;
  submitLabel: string;
}) {
  const router = useRouter();
  return (
    <ActionForm action={action} onSuccess={(d) => router.push(`/admin/${businessId}/jobs/${d.id}`)} refreshOnSuccess={false}>
      {({ fieldErrors }) => (
        <div className="grid gap-6 lg:grid-cols-3">
          <input type="hidden" name="businessId" value={businessId} />
          {values.id && <input type="hidden" name="jobId" value={values.id} />}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader title="Job" />
              <CardBody className="space-y-4">
                <Field label="Title" required error={fieldErrors.title}>
                  <Input name="title" defaultValue={values.title} required maxLength={200} />
                </Field>
                <Field label="Description" error={fieldErrors.description}>
                  <Textarea name="description" rows={4} defaultValue={values.description} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Workflow" required error={fieldErrors.workflowId}>
                    <Select name="workflowId" defaultValue={values.workflowId} required>
                      {workflows.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Priority" error={fieldErrors.priority}>
                    <Select name="priority" defaultValue={String(values.priority)}>
                      {priorities.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </Select>
                  </Field>
                </div>
                <CustomerSelect customers={customers} value={values.customerId} errors={fieldErrors} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Quote" hint="Open quotes for this business" error={fieldErrors.quoteId}>
                    <Select name="quoteId" defaultValue={values.quoteId ?? ""}>
                      <option value="">None</option>
                      {quotes.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Project" error={fieldErrors.projectId}>
                    <Select name="projectId" defaultValue={values.projectId ?? ""}>
                      <option value="">None</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </Select>
                  </Field>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Site address" />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <Field label="Street" className="sm:col-span-2" error={fieldErrors["address.line1"]}>
                  <Input name="address.line1" defaultValue={values.address.line1 ?? ""} />
                </Field>
                <Field label="Suburb"><Input name="address.suburb" defaultValue={values.address.suburb ?? ""} /></Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="State"><Input name="address.state" defaultValue={values.address.state ?? ""} /></Field>
                  <Field label="Postcode"><Input name="address.postcode" defaultValue={values.address.postcode ?? ""} /></Field>
                </div>
              </CardBody>
            </Card>
            {fieldDefs.length > 0 && (
              <Card>
                <CardHeader title="Custom fields" />
                <CardBody>
                  <CustomFieldsForm definitions={fieldDefs} values={fieldValues} businessId={businessId} errors={fieldErrors} />
                </CardBody>
              </Card>
            )}
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader title="Schedule & team" />
              <CardBody className="space-y-4">
                <Field label="Scheduled start" error={fieldErrors.scheduledStart}>
                  <Input type="datetime-local" name="scheduledStart" defaultValue={values.scheduledStart} />
                </Field>
                <Field label="Scheduled end" error={fieldErrors.scheduledEnd}>
                  <Input type="datetime-local" name="scheduledEnd" defaultValue={values.scheduledEnd} />
                </Field>
                <Field label="Assignee" error={fieldErrors.assignedToUserId}>
                  <Select name="assignedToUserId" defaultValue={values.assignedToUserId ?? ""}>
                    <option value="">Unassigned</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </Select>
                </Field>
                <Field label="Value" hint="Total job value, before or after tax as you invoice it" error={fieldErrors.valueCents}>
                  <Input type="number" step="0.01" min="0" name="value" defaultValue={values.value} placeholder="0.00" />
                </Field>
              </CardBody>
            </Card>
            <div className="flex flex-wrap gap-2">
              <SubmitButton>{submitLabel}</SubmitButton>
              <ButtonLink variant="secondary" href={cancelHref}>Cancel</ButtonLink>
            </div>
          </div>
        </div>
      )}
    </ActionForm>
  );
}
