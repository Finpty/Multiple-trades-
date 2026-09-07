"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessAccess } from "@/lib/authz";
import { fail, formToObject, num, ok, optStr, runAction, str, type ActionResult } from "@/lib/actions";
import { isUuid } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import { toCents } from "@/lib/money";
import { coerceFieldValues, listFieldDefinitions, saveFieldValues } from "@/lib/custom-fields";
import { JobInputSchema, createJob, createProjectFromJob, moveJobToStage, restoreJob, setJobStatus, updateJob, type WorkflowStage } from "@/lib/operations/jobs";
import { createDefaultWorkflow, stagesOf, terminalStageKey } from "@/lib/operations/workflows";
import { resolveCustomerFromForm } from "@/lib/operations/customers";
import { TaskInputSchema, createTask, setTaskCompleted } from "@/lib/operations/tasks";
import { zonedToUtc } from "@/lib/operations/dates";

function idFrom(value: unknown, label = "id"): string {
  const id = str(value);
  if (!isUuid(id)) throw new Error(`Invalid ${label}.`);
  return id;
}

function revalidate(businessId: string, jobId?: string) {
  revalidatePath(`/admin/${businessId}/jobs`);
  if (jobId) revalidatePath(`/admin/${businessId}/jobs/${jobId}`);
  revalidatePath(`/admin/${businessId}/tasks`);
}

export async function saveJobAction(_prev: ActionResult<{ id: string }> | undefined, formData: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction<{ id: string }>(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const ctx = await requireBusinessAccess(businessId, "jobs.manage", { throwOnly: true });
    const obj = formToObject(formData);
    const jobId = optStr(obj.jobId);
    const tz = ctx.business.timezone;
    const customerId = await resolveCustomerFromForm(ctx.db, businessId, obj, ctx.user.id);
    const input = JobInputSchema.parse({
      title: str(obj.title),
      description: optStr(obj.description),
      workflowId: str(obj.workflowId),
      customerId,
      quoteId: optStr(obj.quoteId) ?? null,
      projectId: optStr(obj.projectId) ?? null,
      priority: num(obj.priority) ?? 0,
      scheduledStart: zonedToUtc(obj.scheduledStart, tz),
      scheduledEnd: zonedToUtc(obj.scheduledEnd, tz),
      address: { line1: optStr(obj["address.line1"]), suburb: optStr(obj["address.suburb"]), state: optStr(obj["address.state"]), postcode: optStr(obj["address.postcode"]) },
      assignedToUserId: optStr(obj.assignedToUserId) ?? null,
      valueCents: optStr(obj.value) ? toCents(str(obj.value)) : null,
    });
    const defs = await listFieldDefinitions(ctx.db, businessId, "JOB");
    const raw: Record<string, unknown> = {};
    for (const d of defs) raw[d.key] = obj[`cf.${d.key}`];
    const cf = coerceFieldValues(defs, raw);
    if (Object.keys(cf.errors).length) return fail("Please correct the highlighted fields.", cf.errors);
    const job = jobId ? await updateJob(businessId, idFrom(jobId, "job"), input, { actorUserId: ctx.user.id }) : await createJob(businessId, input, { actorUserId: ctx.user.id });
    if (defs.length) await saveFieldValues(ctx.db, businessId, "JOB", job.id, defs, cf.values);
    revalidate(businessId, job.id);
    return ok({ id: job.id }, jobId ? "Job updated" : "Job created");
  });
}

/** Called directly from the kanban board and the stage stepper. */
export async function moveJobAction(businessId: string, jobId: string, toStage: string, note?: string): Promise<ActionResult<{ stageKey: string }>> {
  return runAction<{ stageKey: string }>(async () => {
    const ctx = await requireBusinessAccess(idFrom(businessId, "business"), "jobs.manage", { throwOnly: true });
    const job = await moveJobToStage(businessId, idFrom(jobId, "job"), str(toStage), { actorUserId: ctx.user.id, note: optStr(note) });
    revalidate(businessId, jobId);
    return ok({ stageKey: job.stageKey }, "Job moved");
  });
}

export async function completeJobAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const jobId = idFrom(formData.get("jobId"), "job");
    const ctx = await requireBusinessAccess(businessId, "jobs.manage", { throwOnly: true });
    const job = await ctx.db.job.findFirst({ where: { id: jobId, businessId, deletedAt: null }, include: { workflow: true } });
    if (!job) throw new Error("Job not found.");
    const terminal = terminalStageKey(stagesOf(job.workflow));
    if (!terminal) throw new Error("The workflow has no final stage.");
    await moveJobToStage(businessId, jobId, terminal, { actorUserId: ctx.user.id, note: optStr(formData.get("note")) ?? "Marked complete" });
    revalidate(businessId, jobId);
    return ok(undefined, "Job completed");
  });
}

export async function setJobStatusAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const jobId = idFrom(formData.get("jobId"), "job");
    const status = str(formData.get("status"));
    const ctx = await requireBusinessAccess(businessId, "jobs.manage", { throwOnly: true });
    if (status === "RESTORE") await restoreJob(businessId, jobId, { actorUserId: ctx.user.id });
    else if (status === "CANCELED" || status === "ARCHIVED" || status === "OPEN") await setJobStatus(businessId, jobId, status, { actorUserId: ctx.user.id });
    else throw new Error("Unknown status.");
    revalidate(businessId, jobId);
    return ok(undefined, status === "RESTORE" ? "Job restored" : `Job ${status.toLowerCase()}`);
  });
}

export async function createProjectFromJobAction(_prev: ActionResult<{ projectId: string }> | undefined, formData: FormData): Promise<ActionResult<{ projectId: string }>> {
  return runAction<{ projectId: string }>(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const jobId = idFrom(formData.get("jobId"), "job");
    const ctx = await requireBusinessAccess(businessId, "projects.manage", { throwOnly: true });
    const { projectId } = await createProjectFromJob(businessId, jobId, { actorUserId: ctx.user.id });
    revalidate(businessId, jobId);
    revalidatePath(`/admin/${businessId}/projects`);
    return ok({ projectId }, "Draft project created");
  });
}

export async function addJobNoteAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const jobId = idFrom(formData.get("jobId"), "job");
    const body = str(formData.get("body"));
    if (!body) return fail("Write a note first.", { body: "Note is required" });
    const ctx = await requireBusinessAccess(businessId, "jobs.manage", { throwOnly: true });
    const job = await ctx.db.job.findFirst({ where: { id: jobId, businessId }, select: { customerId: true, number: true } });
    if (!job) throw new Error("Job not found.");
    const m = await ctx.db.message.create({
      data: { businessId, customerId: job.customerId, channel: "NOTE", direction: "INTERNAL", subject: `Note on ${job.number}`, body: body.slice(0, 5000), status: "sent", metadata: { jobId, authorUserId: ctx.user.id, authorName: ctx.user.name } },
    });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "job.note_added", entityType: "job", entityId: jobId, metadata: { messageId: m.id } });
    revalidate(businessId, jobId);
    return ok(undefined, "Note added");
  });
}

export async function addJobTaskAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const jobId = idFrom(formData.get("jobId"), "job");
    const ctx = await requireBusinessAccess(businessId, "jobs.manage", { throwOnly: true });
    const job = await ctx.db.job.findFirst({ where: { id: jobId, businessId }, select: { customerId: true } });
    if (!job) throw new Error("Job not found.");
    const obj = formToObject(formData);
    const input = TaskInputSchema.parse({
      title: str(obj.title),
      dueAt: zonedToUtc(obj.dueAt, ctx.business.timezone),
      assignedToUserId: optStr(obj.assignedToUserId) ?? null,
      priority: num(obj.priority) ?? 0,
      jobId,
      customerId: job.customerId,
    });
    await createTask(businessId, input, { actorUserId: ctx.user.id, source: "job" });
    revalidate(businessId, jobId);
    return ok(undefined, "Task added");
  });
}

export async function toggleJobTaskAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const jobId = idFrom(formData.get("jobId"), "job");
    const taskId = idFrom(formData.get("taskId"), "task");
    const ctx = await requireBusinessAccess(businessId, "jobs.manage", { throwOnly: true });
    await setTaskCompleted(businessId, taskId, str(formData.get("completed")) === "true", { actorUserId: ctx.user.id });
    revalidate(businessId, jobId);
    return ok(undefined);
  });
}

export async function createDefaultWorkflowAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const ctx = await requireBusinessAccess(businessId, "jobs.manage", { throwOnly: true });
    const wf = await createDefaultWorkflow(businessId, ctx.user.id);
    const stages = stagesOf(wf) as WorkflowStage[];
    revalidate(businessId);
    revalidatePath(`/admin/${businessId}/workflows`);
    return ok(undefined, `Workflow "${wf.name}" created with ${stages.length} stages`);
  });
}
