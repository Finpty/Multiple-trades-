import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { formatCents } from "@/lib/money";
import { asObject } from "@/lib/json";
import { JOB_PRIORITIES, addressText } from "@/lib/operations/jobs";
import { customerName } from "@/lib/operations/customers";
import { fmtDateTime, utcToInput } from "@/lib/operations/dates";
import { listTasks, TASK_PRIORITIES, dueTone } from "@/lib/operations/tasks";
import { lineItemsOf } from "@/lib/operations/invoices";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { Alert, Badge, Button, ButtonLink, Card, CardBody, CardHeader, Description, EmptyState, Field, Input, PageHeader, Select, Table, TBody, Td, Th, THead, Tabs, Textarea, statusTone } from "@/components/ui";
import { JobForm } from "@/components/admin/operations/jobs/job-form";
import { loadJobFormData } from "@/components/admin/operations/jobs/job-form-data";
import { StageStepper } from "@/components/admin/operations/jobs/stage-stepper";
import { JobStatusActions } from "@/components/admin/operations/jobs/job-status-actions";
import { columnsOf, stageName } from "@/components/admin/operations/jobs/job-helpers";
import { addJobNoteAction, addJobTaskAction, completeJobAction, createProjectFromJobAction, moveJobAction, saveJobAction, setJobStatusAction, toggleJobTaskAction } from "../actions";

export const dynamic = "force-dynamic";

const TABS = ["details", "history", "tasks", "customer", "quote", "project", "invoices", "notes", "fields"] as const;
type Tab = (typeof TABS)[number];

export default async function JobDetailPage({ params, searchParams }: { params: Promise<{ businessId: string; jobId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { businessId, jobId } = await params;
  if (!isUuid(businessId) || !isUuid(jobId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "jobs.manage");
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "details";
  const job = await ctx.db.job.findFirst({
    where: { id: jobId, businessId },
    include: { workflow: true, customer: true, quote: true, project: { select: { id: true, title: true, status: true, slug: true } }, stageHistory: { orderBy: { createdAt: "desc" } }, invoices: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } } },
  });
  if (!job) notFound();
  const tz = ctx.business.timezone;
  const money = (c: number | null | undefined) => (c == null ? "—" : formatCents(c, ctx.business.currency, ctx.business.locale));
  const base = `/admin/${businessId}/jobs`;
  const here = `${base}/${job.id}`;
  const columns = columnsOf(job.workflow);
  const data = await loadJobFormData(ctx, { jobId: job.id, keepQuoteId: job.quoteId, keepProjectId: job.projectId });
  const assignee = data.memberOptions.find((m) => m.id === job.assignedToUserId);
  const archived = !!job.deletedAt || job.status === "ARCHIVED";
  const tabItems = TABS.map((t) => ({ key: t, label: t === "fields" ? "Custom fields" : t[0]!.toUpperCase() + t.slice(1), href: t === "details" ? here : `${here}?tab=${t}` }));

  return (
    <div>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-2"><span className="font-mono text-base text-neutral-500">{job.number}</span>{job.title}<Badge tone={statusTone(job.status)}>{job.status}</Badge>{job.priority === 2 && <Badge tone="red">Urgent</Badge>}{job.priority === 1 && <Badge tone="amber">High</Badge>}</span>}
        breadcrumbs={[{ label: "Jobs", href: base }, { label: job.number }]}
        description={<span>{job.customer ? customerName(job.customer) : "No customer"} · {money(job.valueCents)} · {assignee ? `Assigned to ${assignee.name}` : "Unassigned"}</span>}
        actions={<JobStatusActions businessId={businessId} jobId={job.id} status={job.status} archived={archived} completeAction={completeJobAction} statusAction={setJobStatusAction} />}
      />
      <Card className="mb-6">
        <CardBody>
          <div className="mb-2 flex items-center justify-between text-xs text-neutral-500"><span>Workflow: {job.workflow.name}</span><span>In stage since {fmtDateTime(job.stageChangedAt, tz)}</span></div>
          <StageStepper stages={columns} current={job.stageKey} jobId={job.id} disabled={archived || job.status === "CANCELED"} onMove={moveJobAction.bind(null, businessId)} />
        </CardBody>
      </Card>
      <Tabs items={tabItems} current={tab} />

      {tab === "details" && (
        <JobForm
          businessId={businessId}
          action={saveJobAction}
          values={{
            id: job.id,
            title: job.title,
            description: job.description ?? "",
            workflowId: job.workflowId,
            customerId: job.customerId,
            quoteId: job.quoteId,
            projectId: job.projectId,
            priority: job.priority,
            scheduledStart: utcToInput(job.scheduledStart, tz),
            scheduledEnd: utcToInput(job.scheduledEnd, tz),
            address: asObject(job.address),
            assignedToUserId: job.assignedToUserId,
            value: job.valueCents != null ? (job.valueCents / 100).toFixed(2) : "",
          }}
          workflows={data.workflows}
          customers={data.customers}
          quotes={data.quotes}
          projects={data.projects}
          members={data.members}
          priorities={JOB_PRIORITIES}
          fieldDefs={data.fieldDefs}
          fieldValues={data.fieldValues}
          cancelHref={base}
          submitLabel="Save changes"
        />
      )}

      {tab === "history" && (
        <Card>
          <CardHeader title="Stage history" description="Every move between stages, newest first." />
          {job.stageHistory.length === 0 ? <CardBody><p className="text-sm text-neutral-500">No stage changes yet.</p></CardBody> : (
            <Table>
              <THead><tr><Th>When</Th><Th>From</Th><Th>To</Th><Th>By</Th><Th>Note</Th></tr></THead>
              <TBody>
                {job.stageHistory.map((h) => (
                  <tr key={h.id}>
                    <Td>{fmtDateTime(h.createdAt, tz)}</Td>
                    <Td>{h.fromStage ? stageName(job.workflow, h.fromStage) : "—"}</Td>
                    <Td>{stageName(job.workflow, h.toStage)}</Td>
                    <Td>{data.memberOptions.find((m) => m.id === h.changedByUserId)?.name ?? (h.changedByUserId ? "Team member" : "System")}</Td>
                    <Td>{h.note ?? ""}</Td>
                  </tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      )}

      {tab === "tasks" && <TasksTab businessId={businessId} jobId={job.id} tz={tz} members={data.members} />}

      {tab === "customer" && (
        <Card>
          <CardHeader title="Customer" actions={job.customer && <ButtonLink variant="secondary" size="sm" href={`/admin/${businessId}/customers/${job.customer.id}`}>Open customer</ButtonLink>} />
          <CardBody>
            {job.customer ? (
              <Description items={[
                { label: "Name", value: customerName(job.customer) },
                { label: "Email", value: job.customer.email ? <a className="underline" href={`mailto:${job.customer.email}`}>{job.customer.email}</a> : "—" },
                { label: "Phone", value: job.customer.phone ? <a className="underline" href={`tel:${job.customer.phone}`}>{job.customer.phone}</a> : "—" },
                { label: "Address", value: addressText(job.customer.address) || "—" },
                { label: "Notes", value: job.customer.notes ?? "—" },
              ]} />
            ) : <EmptyState title="No customer linked" description="Edit the job to choose or create a customer." action={<ButtonLink href={here}>Edit job</ButtonLink>} />}
          </CardBody>
        </Card>
      )}

      {tab === "quote" && (
        <Card>
          <CardHeader title="Quote" actions={job.quote && <ButtonLink variant="secondary" size="sm" href={`/admin/${businessId}/quotes/${job.quote.id}`}>Open quote</ButtonLink>} />
          <CardBody>
            {job.quote ? (
              <>
                <Description items={[{ label: "Number", value: job.quote.number }, { label: "Title", value: job.quote.title }, { label: "Status", value: <Badge tone={statusTone(job.quote.status)}>{job.quote.status}</Badge> }, { label: "Total", value: money(job.quote.totalCents) }, { label: "Accepted", value: job.quote.acceptedAt ? fmtDateTime(job.quote.acceptedAt, tz) : "—" }]} />
                <LineItems items={lineItemsOf(job.quote)} money={money} />
              </>
            ) : <EmptyState title="No quote linked" description="Link an open quote from the Details tab, or create the job directly from a quote." action={<ButtonLink href={here}>Edit job</ButtonLink>} />}
          </CardBody>
        </Card>
      )}

      {tab === "project" && (
        <Card>
          <CardHeader title="Project" description="A portfolio project showcases this work on the website." actions={job.project && <ButtonLink variant="secondary" size="sm" href={`/admin/${businessId}/projects/${job.project.id}`}>Open project</ButtonLink>} />
          <CardBody>
            {job.project ? (
              <Description items={[{ label: "Title", value: job.project.title }, { label: "Status", value: <Badge tone={statusTone(job.project.status)}>{job.project.status}</Badge> }]} />
            ) : ctx.can("projects.manage") ? (
              <ActionForm action={createProjectFromJobAction} successMessage="Draft project created">
                <input type="hidden" name="businessId" value={businessId} />
                <input type="hidden" name="jobId" value={job.id} />
                <p className="mb-3 text-sm text-neutral-600">Creates a draft project pre-filled with this job's title, site location and the services from the linked quote. Add photos and publish it from Projects.</p>
                <SubmitButton pendingText="Creating…">Create project from this job</SubmitButton>
              </ActionForm>
            ) : <Alert tone="info">You need the projects permission to create a project.</Alert>}
          </CardBody>
        </Card>
      )}

      {tab === "invoices" && (
        <Card>
          <CardHeader title="Invoices" actions={ctx.can("invoices.manage") && <ButtonLink size="sm" href={`/admin/${businessId}/invoices/new?jobId=${job.id}`}>Create invoice from job</ButtonLink>} />
          {job.invoices.length === 0 ? <CardBody><p className="text-sm text-neutral-500">No invoices for this job yet.</p></CardBody> : (
            <Table>
              <THead><tr><Th>Number</Th><Th>Status</Th><Th className="text-right">Total</Th><Th className="text-right">Paid</Th><Th>Due</Th></tr></THead>
              <TBody>
                {job.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <Td><Link href={`/admin/${businessId}/invoices/${inv.id}`} className="font-mono text-xs hover:underline">{inv.number}</Link></Td>
                    <Td><Badge tone={statusTone(inv.status)}>{inv.status}</Badge></Td>
                    <Td className="text-right">{money(inv.totalCents)}</Td>
                    <Td className="text-right">{money(inv.paidCents)}</Td>
                    <Td>{inv.dueAt ? fmtDateTime(inv.dueAt, "UTC", { dateStyle: "medium" }) : "—"}</Td>
                  </tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      )}

      {tab === "notes" && <NotesTab businessId={businessId} jobId={job.id} tz={tz} />}

      {tab === "fields" && (
        <Card>
          <CardHeader title="Custom fields" description="Fields defined under Configuration → Custom Fields for jobs." />
          <CardBody>
            {data.fieldDefs.length === 0 ? (
              <EmptyState title="No job fields yet" description="Add fields such as site access notes or tile type under Custom Fields." action={<ButtonLink variant="secondary" href={`/admin/${businessId}/custom-fields`}>Manage custom fields</ButtonLink>} />
            ) : (
              <Description items={data.fieldDefs.map((d) => ({ label: d.label, value: formatFieldValue(data.fieldValues[d.key]) }))} />
            )}
            {data.fieldDefs.length > 0 && <div className="mt-4"><ButtonLink variant="secondary" size="sm" href={here}>Edit values</ButtonLink></div>}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function formatFieldValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.map(String).join(", ");
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).filter(Boolean).map(String).join(", ") || "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function LineItems({ items, money }: { items: Array<{ id?: string; description: string; quantity: number; unit?: string; totalCents: number }>; money: (c: number) => string }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4 overflow-x-auto">
      <Table>
        <THead><tr><Th>Item</Th><Th className="text-right">Qty</Th><Th className="text-right">Total</Th></tr></THead>
        <TBody>{items.map((it, i) => <tr key={it.id ?? i}><Td>{it.description}</Td><Td className="text-right">{it.quantity}{it.unit ? ` ${it.unit}` : ""}</Td><Td className="text-right">{money(it.totalCents)}</Td></tr>)}</TBody>
      </Table>
    </div>
  );
}

async function TasksTab({ businessId, jobId, tz, members }: { businessId: string; jobId: string; tz: string; members: Array<{ id: string; label: string }> }) {
  const ctx = await requireBusinessAccess(businessId, "jobs.manage");
  const [open, done] = await Promise.all([listTasks(ctx.db, businessId, { jobId, scope: "open", assignee: "all" }), listTasks(ctx.db, businessId, { jobId, scope: "completed", assignee: "all" })]);
  const row = (t: (typeof open)[number]) => (
    <li key={t.id} className="flex flex-wrap items-center gap-3 py-2">
      <ActionForm action={toggleJobTaskAction} className="contents">
        <input type="hidden" name="businessId" value={businessId} />
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="taskId" value={t.id} />
        <input type="hidden" name="completed" value={t.completedAt ? "false" : "true"} />
        <Button type="submit" variant="secondary" size="sm">{t.completedAt ? "Reopen" : "Complete"}</Button>
      </ActionForm>
      <span className={t.completedAt ? "text-neutral-400 line-through" : "text-neutral-900"}>{t.title}</span>
      {t.dueAt && <Badge tone={dueTone(t)}>Due {fmtDateTime(t.dueAt, tz)}</Badge>}
      {t.priority > 0 && <Badge tone={t.priority === 2 ? "red" : "amber"}>{TASK_PRIORITIES.find((p) => p.value === t.priority)?.label}</Badge>}
      <span className="ml-auto text-xs text-neutral-500">{members.find((m) => m.id === t.assignedToUserId)?.label ?? "Unassigned"}</span>
    </li>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Tasks" description={`${open.length} open · ${done.length} completed`} actions={<ButtonLink variant="secondary" size="sm" href={`/admin/${businessId}/tasks?job=${jobId}`}>All tasks</ButtonLink>} />
        <CardBody>
          {open.length === 0 && done.length === 0 ? <p className="text-sm text-neutral-500">No tasks yet — add the first one on the right.</p> : (
            <ul className="divide-y divide-neutral-100">{open.map(row)}{done.map(row)}</ul>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Add task" />
        <CardBody>
          <ActionForm action={addJobTaskAction} resetOnSuccess successMessage="Task added">
            <div className="space-y-3">
                <input type="hidden" name="businessId" value={businessId} />
                <input type="hidden" name="jobId" value={jobId} />
                <Field label="Title" required><Input name="title" required placeholder="Order materials" /></Field>
                <Field label="Due"><Input type="datetime-local" name="dueAt" /></Field>
                <Field label="Assignee"><Select name="assignedToUserId" defaultValue=""><option value="">Unassigned</option>{members.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</Select></Field>
                <Field label="Priority"><Select name="priority" defaultValue="0">{TASK_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</Select></Field>
                <SubmitButton pendingText="Adding…">Add task</SubmitButton>
            </div>
          </ActionForm>
        </CardBody>
      </Card>
    </div>
  );
}

async function NotesTab({ businessId, jobId, tz }: { businessId: string; jobId: string; tz: string }) {
  const ctx = await requireBusinessAccess(businessId, "jobs.manage");
  const notes = await ctx.db.message.findMany({ where: { businessId, channel: "NOTE", metadata: { path: ["jobId"], equals: jobId } }, orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Notes" description="Internal notes, also visible on the customer's timeline." />
        <CardBody>
          {notes.length === 0 ? <p className="text-sm text-neutral-500">No notes yet.</p> : (
            <ul className="space-y-3">
              {notes.map((n) => {
                const meta = asObject<{ authorName?: string; automationRuleId?: string }>(n.metadata);
                return (
                  <li key={n.id} className="rounded-lg border border-neutral-200 p-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-neutral-500"><span>{meta.authorName ?? (meta.automationRuleId ? "Automation" : "Team")}</span><span>{fmtDateTime(n.createdAt, tz)}</span></div>
                    <p className="whitespace-pre-wrap text-sm text-neutral-800">{n.body}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Add note" />
        <CardBody>
          <ActionForm action={addJobNoteAction} resetOnSuccess successMessage="Note added">
            <div className="space-y-3">
                <input type="hidden" name="businessId" value={businessId} />
                <input type="hidden" name="jobId" value={jobId} />
                <Field label="Note" required><Textarea name="body" rows={4} required placeholder="Site access via side gate…" /></Field>
                <SubmitButton pendingText="Saving…">Add note</SubmitButton>
            </div>
          </ActionForm>
        </CardBody>
      </Card>
    </div>
  );
}
