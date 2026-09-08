import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { listTasks, TASK_PRIORITIES, dueTone } from "@/lib/operations/tasks";
import { listAssignees } from "@/lib/operations/members";
import { customerName } from "@/lib/operations/customers";
import { fmtDateTime } from "@/lib/operations/dates";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Select, cn } from "@/components/ui";
import { deleteTaskAction, toggleTaskAction } from "./actions";

export const dynamic = "force-dynamic";

type SP = { scope?: string; due?: string; assignee?: string; job?: string };

export default async function TasksPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<SP> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "jobs.manage");
  const sp = await searchParams;
  const scope = sp.scope === "completed" ? "completed" : "open";
  const due = (["overdue", "today", "week"] as const).find((d) => d === sp.due) ?? "";
  // "My tasks" is the default; "all" or a specific member id widens it.
  const assignee = sp.assignee === "all" || sp.assignee === "unassigned" || isUuid(sp.assignee) ? sp.assignee! : ctx.user.id;
  const jobId = isUuid(sp.job) ? sp.job : undefined;
  const [tasks, members] = await Promise.all([listTasks(ctx.db, businessId, { scope, due, assignee, jobId }), listAssignees(ctx.db, businessId, ctx.user)]);
  const tz = ctx.business.timezone;
  const base = `/admin/${businessId}/tasks`;
  const qs = (extra: Partial<SP>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, assignee, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  const pill = (active: boolean) => cn("rounded-full px-3 py-1 text-sm", active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100");

  return (
    <div>
      <PageHeader title="Tasks" description="Follow-ups for you and your team, linked to jobs, leads and customers." actions={<ButtonLink href={`${base}/new${jobId ? `?jobId=${jobId}` : ""}`}>New task</ButtonLink>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Link href={qs({ scope: undefined })} className={pill(scope === "open")}>Open</Link>
          <Link href={qs({ scope: "completed" })} className={pill(scope === "completed")}>Completed</Link>
        </div>
        <span className="mx-1 h-5 w-px bg-neutral-200" />
        <div className="flex items-center gap-1">
          <Link href={qs({ due: undefined })} className={pill(due === "")}>Any due date</Link>
          <Link href={qs({ due: "overdue" })} className={pill(due === "overdue")}>Overdue</Link>
          <Link href={qs({ due: "today" })} className={pill(due === "today")}>Today</Link>
          <Link href={qs({ due: "week" })} className={pill(due === "week")}>This week</Link>
        </div>
        <form method="get" action={base} className="ml-auto flex items-center gap-2">
          {scope === "completed" && <input type="hidden" name="scope" value="completed" />}
          {due && <input type="hidden" name="due" value={due} />}
          {jobId && <input type="hidden" name="job" value={jobId} />}
          <Select name="assignee" defaultValue={assignee} className="w-auto" aria-label="Assignee">
            <option value={ctx.user.id}>My tasks</option>
            <option value="all">Everyone</option>
            <option value="unassigned">Unassigned</option>
            {members.filter((m) => m.id !== ctx.user.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <button type="submit" className="text-sm text-neutral-600 hover:text-neutral-900">Apply</button>
        </form>
      </div>
      {jobId && <p className="mb-3 text-sm text-neutral-600">Showing tasks for one job. <Link href={qs({ job: undefined })} className="underline">Show all</Link></p>}

      {tasks.length === 0 ? (
        <EmptyState
          title={scope === "completed" ? "Nothing completed yet" : assignee === ctx.user.id ? "You're all caught up" : "No tasks match"}
          description={scope === "completed" ? "Completed tasks will appear here." : "Create a task, or switch the assignee filter to see the whole team."}
          action={<ButtonLink href={`${base}/new`}>New task</ButtonLink>}
        />
      ) : (
        <Card>
          <ul className="divide-y divide-neutral-100">
            {tasks.map((t) => {
              const m = members.find((x) => x.id === t.assignedToUserId);
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <ActionForm action={toggleTaskAction} className="contents">
                    <input type="hidden" name="businessId" value={businessId} />
                    <input type="hidden" name="taskId" value={t.id} />
                    <input type="hidden" name="completed" value={t.completedAt ? "false" : "true"} />
                    <SubmitButton variant="secondary" size="sm" pendingText="…">{t.completedAt ? "Reopen" : "Complete"}</SubmitButton>
                  </ActionForm>
                  <div className="min-w-0 flex-1">
                    <Link href={`${base}/${t.id}`} className={cn("block truncate font-medium hover:underline", t.completedAt ? "text-neutral-400 line-through" : "text-neutral-900")}>{t.title}</Link>
                    <div className="flex flex-wrap gap-x-3 text-xs text-neutral-500">
                      {t.job && <Link href={`/admin/${businessId}/jobs/${t.job.id}`} className="hover:underline">{t.job.number} · {t.job.title}</Link>}
                      {t.lead && <Link href={`/admin/${businessId}/leads/${t.lead.id}`} className="hover:underline">Lead: {t.lead.name}</Link>}
                      {t.customer && <Link href={`/admin/${businessId}/customers/${t.customer.id}`} className="hover:underline">{customerName(t.customer)}</Link>}
                      {t.source?.startsWith("automation") && <span>Created by automation</span>}
                    </div>
                  </div>
                  {t.priority > 0 && <Badge tone={t.priority === 2 ? "red" : "amber"}>{TASK_PRIORITIES.find((p) => p.value === t.priority)?.label}</Badge>}
                  {t.dueAt && <Badge tone={dueTone(t)}>{t.completedAt ? "Was due" : "Due"} {fmtDateTime(t.dueAt, tz)}</Badge>}
                  {t.completedAt && <span className="text-xs text-neutral-500">Done {fmtDateTime(t.completedAt, tz)}</span>}
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-700" title={m?.name ?? "Unassigned"}>{m?.initials ?? "—"}</span>
                  <ActionForm action={deleteTaskAction} className="contents">
                    <input type="hidden" name="businessId" value={businessId} />
                    <input type="hidden" name="taskId" value={t.id} />
                    <ConfirmButton variant="ghost" size="sm" confirm="Delete this task permanently?">Delete</ConfirmButton>
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
