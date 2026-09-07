"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessAccess } from "@/lib/authz";
import { bool, formToObject, ok, optStr, runAction, str, type ActionResult } from "@/lib/actions";
import { isUuid } from "@/lib/ids";
import { WorkflowInputSchema, archiveWorkflow, duplicateWorkflow, saveWorkflow, setDefaultWorkflow } from "@/lib/operations/workflows";

function idFrom(value: unknown, label = "id"): string {
  const id = str(value);
  if (!isUuid(id)) throw new Error(`Invalid ${label}.`);
  return id;
}

function revalidate(businessId: string, workflowId?: string) {
  revalidatePath(`/admin/${businessId}/workflows`);
  if (workflowId) revalidatePath(`/admin/${businessId}/workflows/${workflowId}`);
  revalidatePath(`/admin/${businessId}/jobs`);
}

export async function saveWorkflowAction(_prev: ActionResult<{ id: string }> | undefined, formData: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction<{ id: string }>(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const ctx = await requireBusinessAccess(businessId, "jobs.manage", { throwOnly: true });
    const obj = formToObject(formData);
    const workflowId = optStr(obj.workflowId);
    const input = WorkflowInputSchema.parse({
      name: str(obj.name),
      key: str(obj.key),
      description: optStr(obj.description),
      isDefault: bool(obj.isDefault),
      serviceId: optStr(obj.serviceId) ?? null,
      stages: Array.isArray(obj.stages) ? obj.stages : [],
      stageMoves: obj.stageMoves && typeof obj.stageMoves === "object" ? obj.stageMoves : {},
    });
    const wf = await saveWorkflow(businessId, input, workflowId ? idFrom(workflowId, "workflow") : null, ctx.user.id);
    revalidate(businessId, wf.id);
    return ok({ id: wf.id }, workflowId ? "Workflow saved" : "Workflow created");
  });
}

export async function duplicateWorkflowAction(_prev: ActionResult<{ id: string }> | undefined, formData: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction<{ id: string }>(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const workflowId = idFrom(formData.get("workflowId"), "workflow");
    const ctx = await requireBusinessAccess(businessId, "jobs.manage", { throwOnly: true });
    const copy = await duplicateWorkflow(businessId, workflowId, ctx.user.id);
    revalidate(businessId, copy.id);
    return ok({ id: copy.id }, "Workflow duplicated");
  });
}

export async function archiveWorkflowAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const workflowId = idFrom(formData.get("workflowId"), "workflow");
    const ctx = await requireBusinessAccess(businessId, "jobs.manage", { throwOnly: true });
    await archiveWorkflow(businessId, workflowId, ctx.user.id);
    revalidate(businessId, workflowId);
    return ok(undefined, "Workflow archived");
  });
}

export async function setDefaultWorkflowAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const workflowId = idFrom(formData.get("workflowId"), "workflow");
    const ctx = await requireBusinessAccess(businessId, "jobs.manage", { throwOnly: true });
    await setDefaultWorkflow(businessId, workflowId, ctx.user.id);
    revalidate(businessId, workflowId);
    return ok(undefined, "Default workflow updated");
  });
}
