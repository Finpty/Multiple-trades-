"use client";

import { useRouter } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { ButtonLink, Card, CardBody, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";

export interface TaskFormOption {
  id: string;
  label: string;
}

export interface TaskFormValues {
  id?: string;
  title: string;
  description: string;
  dueAt: string;
  assignedToUserId: string | null;
  priority: number;
  jobId: string | null;
  leadId: string | null;
  customerId: string | null;
}

export function TaskForm({ businessId, action, values, members, jobs, leads, customers, priorities, cancelHref, submitLabel, redirectTo }: {
  businessId: string;
  action: (prev: ActionResult<{ id: string }> | undefined, fd: FormData) => Promise<ActionResult<{ id: string }>>;
  values: TaskFormValues;
  members: TaskFormOption[];
  jobs: TaskFormOption[];
  leads: TaskFormOption[];
  customers: TaskFormOption[];
  priorities: Array<{ value: number; label: string }>;
  cancelHref: string;
  submitLabel: string;
  redirectTo: string;
}) {
  const router = useRouter();
  return (
    <ActionForm action={action} onSuccess={() => router.push(redirectTo)} refreshOnSuccess={false}>
      {({ fieldErrors }) => (
        <div className="grid gap-6 lg:grid-cols-3">
          <input type="hidden" name="businessId" value={businessId} />
          {values.id && <input type="hidden" name="taskId" value={values.id} />}
          <Card className="lg:col-span-2">
            <CardHeader title="Task" />
            <CardBody className="space-y-4">
              <Field label="Title" required error={fieldErrors.title}>
                <Input name="title" defaultValue={values.title} required maxLength={200} placeholder="Call customer to confirm start date" />
              </Field>
              <Field label="Description" error={fieldErrors.description}>
                <Textarea name="description" rows={4} defaultValue={values.description} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Linked job" error={fieldErrors.jobId}>
                  <Select name="jobId" defaultValue={values.jobId ?? ""}>
                    <option value="">None</option>
                    {jobs.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
                  </Select>
                </Field>
                <Field label="Linked lead" error={fieldErrors.leadId}>
                  <Select name="leadId" defaultValue={values.leadId ?? ""}>
                    <option value="">None</option>
                    {leads.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </Select>
                </Field>
                <Field label="Linked customer" error={fieldErrors.customerId}>
                  <Select name="customerId" defaultValue={values.customerId ?? ""}>
                    <option value="">None</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </Select>
                </Field>
              </div>
            </CardBody>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader title="Schedule" />
              <CardBody className="space-y-4">
                <Field label="Due" error={fieldErrors.dueAt}>
                  <Input type="datetime-local" name="dueAt" defaultValue={values.dueAt} />
                </Field>
                <Field label="Assignee" error={fieldErrors.assignedToUserId}>
                  <Select name="assignedToUserId" defaultValue={values.assignedToUserId ?? ""}>
                    <option value="">Unassigned</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </Select>
                </Field>
                <Field label="Priority" error={fieldErrors.priority}>
                  <Select name="priority" defaultValue={String(values.priority)}>
                    {priorities.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </Select>
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
