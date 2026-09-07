import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { formatCents } from "@/lib/money";
import { listJobs } from "@/lib/operations/jobs";
import { listAssignees } from "@/lib/operations/members";
import { customerName } from "@/lib/operations/customers";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { Badge, Button, ButtonLink, Card, EmptyState, Input, PageHeader, Select, Table, TBody, Td, Th, THead, cn, statusTone } from "@/components/ui";
import { KanbanBoard } from "@/components/admin/operations/jobs/kanban-board";
import { columnsOf, scheduleText, stageName, toCard } from "@/components/admin/operations/jobs/job-helpers";
import { createDefaultWorkflowAction, moveJobAction } from "./actions";

export const dynamic = "force-dynamic";

type SP = { view?: string; workflow?: string; status?: string; stage?: string; assignee?: string; from?: string; to?: string; q?: string };

export default async function JobsPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<SP> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "jobs.manage");
  const sp = await searchParams;
  const base = `/admin/${businessId}/jobs`;
  const workflows = await ctx.db.workflow.findMany({ where: { businessId, deletedAt: null }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] });

  if (workflows.length === 0) {
    return (
      <div>
        <PageHeader title="Jobs" description="Track every job from enquiry to completion on a board built from your workflow stages." />
        <EmptyState
          title="Set up your first workflow"
          description="Jobs move through the stages of a workflow. Create one from your industry's default stages in one click, then customise it any time."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ActionForm action={createDefaultWorkflowAction}>
                <input type="hidden" name="businessId" value={businessId} />
                <SubmitButton pendingText="Creating…">Create default workflow</SubmitButton>
              </ActionForm>
              <ButtonLink variant="secondary" href={`/admin/${businessId}/workflows/new`}>Build one from scratch</ButtonLink>
            </div>
          }
        />
      </div>
    );
  }

  const workflow = (isUuid(sp.workflow) && workflows.find((w) => w.id === sp.workflow)) || workflows.find((w) => w.isDefault) || workflows[0]!;
  const view = sp.view === "list" ? "list" : "board";
  const members = await listAssignees(ctx.db, businessId, ctx.user);
  const business = { id: businessId, currency: ctx.business.currency, locale: ctx.business.locale, timezone: ctx.business.timezone };
  const columns = columnsOf(workflow);
  const money = (cents: number) => formatCents(cents, business.currency, business.locale);

  const jobs = await listJobs(ctx.db, businessId, view === "board"
    ? { workflowId: workflow.id, status: "OPEN", q: sp.q, assignee: isUuid(sp.assignee) || sp.assignee === "unassigned" ? sp.assignee : undefined }
    : { workflowId: workflow.id, status: sp.status, stage: sp.stage, assignee: isUuid(sp.assignee) || sp.assignee === "unassigned" ? sp.assignee : undefined, from: sp.from, to: sp.to, q: sp.q });

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <div>
      <PageHeader
        title="Jobs"
        description={`${jobs.length} ${view === "board" ? "open" : ""} job${jobs.length === 1 ? "" : "s"} in "${workflow.name}"`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5 text-sm">
              <Link href={qs({ view: undefined })} className={cn("rounded px-3 py-1", view === "board" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100")}>Board</Link>
              <Link href={qs({ view: "list" })} className={cn("rounded px-3 py-1", view === "list" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100")}>List</Link>
            </div>
            <ButtonLink href={`${base}/new?workflow=${workflow.id}`}>New job</ButtonLink>
          </div>
        }
      />

      <form method="get" action={base} className="mb-4 flex flex-wrap items-end gap-2">
        {view === "list" && <input type="hidden" name="view" value="list" />}
        {workflows.length > 1 && (
          <Select name="workflow" defaultValue={workflow.id} className="w-auto" aria-label="Workflow">
            {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
        )}
        <Input name="q" defaultValue={sp.q ?? ""} placeholder="Search number, title, customer" className="w-56" />
        <Select name="assignee" defaultValue={sp.assignee ?? ""} className="w-auto" aria-label="Assignee">
          <option value="">Anyone</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
        {view === "list" && (
          <>
            <Select name="status" defaultValue={sp.status ?? ""} className="w-auto" aria-label="Status">
              <option value="">Any status</option>
              <option value="OPEN">Open</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELED">Canceled</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
            <Select name="stage" defaultValue={sp.stage ?? ""} className="w-auto" aria-label="Stage">
              <option value="">Any stage</option>
              {columns.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
            </Select>
            <Input type="date" name="from" defaultValue={sp.from ?? ""} className="w-auto" aria-label="Scheduled from" />
            <Input type="date" name="to" defaultValue={sp.to ?? ""} className="w-auto" aria-label="Scheduled to" />
          </>
        )}
        <Button type="submit" variant="secondary">Filter</Button>
        {(sp.q || sp.assignee || sp.status || sp.stage || sp.from || sp.to) && <Link href={qs({ q: undefined, assignee: undefined, status: undefined, stage: undefined, from: undefined, to: undefined })} className="text-sm text-neutral-500 hover:text-neutral-900">Clear</Link>}
      </form>

      {view === "board" ? (
        jobs.length === 0 && !sp.q && !sp.assignee ? (
          <EmptyState title="No open jobs yet" description="Create a job manually, accept a quote, or convert a booking — it will appear in the first column." action={<ButtonLink href={`${base}/new?workflow=${workflow.id}`}>Create a job</ButtonLink>} />
        ) : (
          <KanbanBoard columns={columns} cards={jobs.map((j) => toCard(j, members, business))} onMove={moveJobAction.bind(null, businessId)} formatTotal={money} />
        )
      ) : jobs.length === 0 ? (
        <EmptyState title="No jobs match" description="Try clearing the filters, or create a new job." action={<ButtonLink href={`${base}/new?workflow=${workflow.id}`}>Create a job</ButtonLink>} />
      ) : (
        <Card>
          <Table>
            <THead>
              <tr>
                <Th>Number</Th><Th>Title</Th><Th>Customer</Th><Th>Stage</Th><Th>Status</Th><Th>Scheduled</Th><Th>Assignee</Th><Th className="text-right">Value</Th>
              </tr>
            </THead>
            <TBody>
              {jobs.map((j) => {
                const m = members.find((x) => x.id === j.assignedToUserId);
                return (
                  <tr key={j.id}>
                    <Td><Link href={`${base}/${j.id}`} className="font-mono text-xs hover:underline">{j.number}</Link></Td>
                    <Td><Link href={`${base}/${j.id}`} className="font-medium text-neutral-900 hover:underline">{j.title}</Link></Td>
                    <Td>{j.customer ? customerName(j.customer) : "—"}</Td>
                    <Td>{stageName(j.workflow, j.stageKey)}</Td>
                    <Td><Badge tone={statusTone(j.status)}>{j.status}</Badge></Td>
                    <Td>{scheduleText(j, business.timezone) ?? "—"}</Td>
                    <Td>{m?.name ?? "—"}</Td>
                    <Td className="text-right">{j.valueCents ? money(j.valueCents) : "—"}</Td>
                  </tr>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
