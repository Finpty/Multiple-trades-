import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { TASK_PRIORITIES } from "@/lib/operations/tasks";
import { fmtDateTime, utcToInput } from "@/lib/operations/dates";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Badge, PageHeader } from "@/components/ui";
import { TaskForm } from "@/components/admin/operations/tasks/task-form";
import { loadTaskFormData } from "@/components/admin/operations/tasks/task-form-data";
import { deleteTaskAction, saveTaskAction, toggleTaskAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditTaskPage({ params }: { params: Promise<{ businessId: string; taskId: string }> }) {
  const { businessId, taskId } = await params;
  if (!isUuid(businessId) || !isUuid(taskId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "jobs.manage");
  const task = await ctx.db.task.findFirst({ where: { id: taskId, businessId } });
  if (!task) notFound();
  const data = await loadTaskFormData(ctx, { jobId: task.jobId, leadId: task.leadId });
  const base = `/admin/${businessId}/tasks`;
  const tz = ctx.business.timezone;
  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-2">{task.title}{task.completedAt ? <Badge tone="green">Completed</Badge> : <Badge tone="blue">Open</Badge>}</span>}
        breadcrumbs={[{ label: "Tasks", href: base }, { label: "Edit" }]}
        description={task.completedAt ? `Completed ${fmtDateTime(task.completedAt, tz)}` : task.dueAt ? `Due ${fmtDateTime(task.dueAt, tz)}` : "No due date"}
        actions={
          <div className="flex flex-wrap gap-2">
            <ActionForm action={toggleTaskAction}>
              <input type="hidden" name="businessId" value={businessId} />
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="completed" value={task.completedAt ? "false" : "true"} />
              <SubmitButton variant="secondary" pendingText="…">{task.completedAt ? "Reopen" : "Mark complete"}</SubmitButton>
            </ActionForm>
            <ActionForm action={deleteTaskAction} onSuccess={undefined}>
              <input type="hidden" name="businessId" value={businessId} />
              <input type="hidden" name="taskId" value={task.id} />
              <ConfirmButton variant="danger" confirm="Delete this task permanently?">Delete</ConfirmButton>
            </ActionForm>
          </div>
        }
      />
      <TaskForm
        businessId={businessId}
        action={saveTaskAction}
        values={{ id: task.id, title: task.title, description: task.description ?? "", dueAt: utcToInput(task.dueAt, tz), assignedToUserId: task.assignedToUserId, priority: task.priority, jobId: task.jobId, leadId: task.leadId, customerId: task.customerId }}
        members={data.members}
        jobs={data.jobs}
        leads={data.leads}
        customers={data.customers}
        priorities={TASK_PRIORITIES}
        cancelHref={base}
        submitLabel="Save task"
        redirectTo={base}
      />
    </div>
  );
}
