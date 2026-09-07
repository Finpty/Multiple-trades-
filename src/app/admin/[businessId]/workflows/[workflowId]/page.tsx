import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { jobsPerStage, stagesOf } from "@/lib/operations/workflows";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Badge, ButtonLink, PageHeader } from "@/components/ui";
import { WorkflowEditor } from "@/components/admin/operations/workflows/workflow-editor";
import { archiveWorkflowAction, duplicateWorkflowAction, saveWorkflowAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditWorkflowPage({ params }: { params: Promise<{ businessId: string; workflowId: string }> }) {
  const { businessId, workflowId } = await params;
  if (!isUuid(businessId) || !isUuid(workflowId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "jobs.manage");
  const workflow = await ctx.db.workflow.findFirst({ where: { id: workflowId, businessId, deletedAt: null } });
  if (!workflow) notFound();
  const [services, count, jobCounts, totalJobs] = await Promise.all([
    ctx.db.service.findMany({ where: { businessId, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ctx.db.workflow.count({ where: { businessId, deletedAt: null } }),
    jobsPerStage(ctx.db, businessId, workflowId),
    ctx.db.job.count({ where: { businessId, workflowId, deletedAt: null } }),
  ]);
  const base = `/admin/${businessId}/workflows`;
  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-2">{workflow.name}{workflow.isDefault && <Badge tone="green">Default</Badge>}</span>}
        breadcrumbs={[{ label: "Workflows", href: base }, { label: workflow.name }]}
        description={`${totalJobs} job${totalJobs === 1 ? "" : "s"} use this workflow.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink variant="secondary" href={`/admin/${businessId}/jobs?workflow=${workflow.id}`}>Open board</ButtonLink>
            <ActionForm action={duplicateWorkflowAction}>
              <input type="hidden" name="businessId" value={businessId} />
              <input type="hidden" name="workflowId" value={workflow.id} />
              <SubmitButton variant="secondary" pendingText="Duplicating…">Duplicate</SubmitButton>
            </ActionForm>
            <ActionForm action={archiveWorkflowAction}>
              <input type="hidden" name="businessId" value={businessId} />
              <input type="hidden" name="workflowId" value={workflow.id} />
              <ConfirmButton variant="danger" confirm="Archive this workflow? This is blocked while jobs still use it." disabled={totalJobs > 0}>Archive</ConfirmButton>
            </ActionForm>
          </div>
        }
      />
      <WorkflowEditor
        businessId={businessId}
        action={saveWorkflowAction}
        values={{ id: workflow.id, name: workflow.name, key: workflow.key, description: workflow.description ?? "", isDefault: workflow.isDefault, serviceId: workflow.serviceId, stages: stagesOf(workflow) }}
        services={services}
        jobCounts={jobCounts}
        cancelHref={base}
        isOnlyWorkflow={count <= 1}
      />
    </div>
  );
}
