import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { TASK_PRIORITIES } from "@/lib/operations/tasks";
import { PageHeader } from "@/components/ui";
import { TaskForm } from "@/components/admin/operations/tasks/task-form";
import { loadTaskFormData } from "@/components/admin/operations/tasks/task-form-data";
import { saveTaskAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewTaskPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ jobId?: string; leadId?: string; customerId?: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "jobs.manage");
  const sp = await searchParams;
  const data = await loadTaskFormData(ctx, { jobId: isUuid(sp.jobId) ? sp.jobId : null, leadId: isUuid(sp.leadId) ? sp.leadId : null });
  const base = `/admin/${businessId}/tasks`;
  return (
    <div>
      <PageHeader title="New task" breadcrumbs={[{ label: "Tasks", href: base }, { label: "New" }]} />
      <TaskForm
        businessId={businessId}
        action={saveTaskAction}
        values={{ title: "", description: "", dueAt: "", assignedToUserId: ctx.user.id, priority: 0, jobId: isUuid(sp.jobId) ? sp.jobId : null, leadId: isUuid(sp.leadId) ? sp.leadId : null, customerId: isUuid(sp.customerId) ? sp.customerId : null }}
        members={data.members}
        jobs={data.jobs}
        leads={data.leads}
        customers={data.customers}
        priorities={TASK_PRIORITIES}
        cancelHref={base}
        submitLabel="Create task"
        redirectTo={base}
      />
    </div>
  );
}
