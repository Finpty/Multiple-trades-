import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { listWorkflows } from "@/lib/operations/workflows";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Table, TBody, Td, Th, THead, formatDate } from "@/components/ui";
import { createDefaultWorkflowAction } from "../jobs/actions";
import { archiveWorkflowAction, duplicateWorkflowAction, setDefaultWorkflowAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "jobs.manage");
  const rows = await listWorkflows(ctx.db, businessId);
  const base = `/admin/${businessId}/workflows`;
  return (
    <div>
      <PageHeader
        title="Workflows"
        description="Each workflow defines the stages a job moves through. The default workflow is used for new jobs unless another is chosen."
        actions={<ButtonLink href={`${base}/new`}>New workflow</ButtonLink>}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No workflows yet"
          description="Create one from your industry's default stages, or build your own from scratch."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ActionForm action={createDefaultWorkflowAction}>
                <input type="hidden" name="businessId" value={businessId} />
                <SubmitButton pendingText="Creating…">Create default workflow</SubmitButton>
              </ActionForm>
              <ButtonLink variant="secondary" href={`${base}/new`}>Build from scratch</ButtonLink>
            </div>
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <tr><Th>Name</Th><Th>Key</Th><Th>Service</Th><Th className="text-right">Stages</Th><Th className="text-right">Open jobs</Th><Th>Updated</Th><Th className="text-right">Actions</Th></tr>
            </THead>
            <TBody>
              {rows.map((w) => (
                <tr key={w.id}>
                  <Td>
                    <Link href={`${base}/${w.id}`} className="font-medium text-neutral-900 hover:underline">{w.name}</Link>
                    {w.isDefault && <Badge tone="green" className="ml-2">Default</Badge>}
                    {w.description && <div className="text-xs text-neutral-500">{w.description}</div>}
                  </Td>
                  <Td><code className="text-xs">{w.key}</code></Td>
                  <Td>{w.serviceName ?? <span className="text-neutral-400">Any</span>}</Td>
                  <Td className="text-right">{w.stageCount}</Td>
                  <Td className="text-right"><Link href={`/admin/${businessId}/jobs?workflow=${w.id}`} className="hover:underline">{w.openJobs}</Link></Td>
                  <Td>{formatDate(w.updatedAt)}</Td>
                  <Td>
                    <div className="flex flex-wrap justify-end gap-1">
                      {!w.isDefault && (
                        <ActionForm action={setDefaultWorkflowAction}>
                          <input type="hidden" name="businessId" value={businessId} />
                          <input type="hidden" name="workflowId" value={w.id} />
                          <SubmitButton variant="ghost" size="sm" pendingText="…">Make default</SubmitButton>
                        </ActionForm>
                      )}
                      <ActionForm action={duplicateWorkflowAction}>
                        <input type="hidden" name="businessId" value={businessId} />
                        <input type="hidden" name="workflowId" value={w.id} />
                        <SubmitButton variant="ghost" size="sm" pendingText="…">Duplicate</SubmitButton>
                      </ActionForm>
                      <ActionForm action={archiveWorkflowAction}>
                        <input type="hidden" name="businessId" value={businessId} />
                        <input type="hidden" name="workflowId" value={w.id} />
                        <ConfirmButton variant="ghost" size="sm" confirm={`Archive "${w.name}"? This is blocked while jobs still use it.`}>Archive</ConfirmButton>
                      </ActionForm>
                    </div>
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
