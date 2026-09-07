import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { PageHeader } from "@/components/ui";
import { WorkflowEditor } from "@/components/admin/operations/workflows/workflow-editor";
import { saveWorkflowAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewWorkflowPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "jobs.manage");
  const [services, count] = await Promise.all([
    ctx.db.service.findMany({ where: { businessId, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ctx.db.workflow.count({ where: { businessId, deletedAt: null } }),
  ]);
  const base = `/admin/${businessId}/workflows`;
  return (
    <div>
      <PageHeader title="New workflow" breadcrumbs={[{ label: "Workflows", href: base }, { label: "New" }]} description="Define the stages jobs move through on the board." />
      <WorkflowEditor
        businessId={businessId}
        action={saveWorkflowAction}
        values={{ name: "", key: "", description: "", isDefault: count === 0, serviceId: null, stages: [{ key: "new", name: "New" }, { key: "in_progress", name: "In progress" }, { key: "completed", name: "Completed", isTerminal: true }] }}
        services={services}
        jobCounts={{}}
        cancelHref={base}
        isOnlyWorkflow={count === 0}
      />
    </div>
  );
}
