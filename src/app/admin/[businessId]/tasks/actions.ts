"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessAccess } from "@/lib/authz";
import { formToObject, num, ok, optStr, runAction, str, type ActionResult } from "@/lib/actions";
import { isUuid } from "@/lib/ids";
import { TaskInputSchema, createTask, deleteTask, setTaskCompleted, updateTask } from "@/lib/operations/tasks";
import { zonedToUtc } from "@/lib/operations/dates";

function idFrom(value: unknown, label = "id"): string {
  const id = str(value);
  if (!isUuid(id)) throw new Error(`Invalid ${label}.`);
  return id;
}

function revalidate(businessId: string, taskId?: string, jobId?: string | null) {
  revalidatePath(`/admin/${businessId}/tasks`);
  if (taskId) revalidatePath(`/admin/${businessId}/tasks/${taskId}`);
  if (jobId) revalidatePath(`/admin/${businessId}/jobs/${jobId}`);
}

export async function saveTaskAction(_prev: ActionResult<{ id: string }> | undefined, formData: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction<{ id: string }>(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const ctx = await requireBusinessAccess(businessId, "jobs.manage", { throwOnly: true });
    const obj = formToObject(formData);
    const taskId = optStr(obj.taskId);
    const input = TaskInputSchema.parse({
      title: str(obj.title),
      description: optStr(obj.description),
      dueAt: zonedToUtc(obj.dueAt, ctx.business.timezone),
      assignedToUserId: optStr(obj.assignedToUserId) ?? null,
      priority: num(obj.priority) ?? 0,
      jobId: optStr(obj.jobId) ?? null,
      leadId: optStr(obj.leadId) ?? null,
      customerId: optStr(obj.customerId) ?? null,
    });
    const task = taskId ? await updateTask(businessId, idFrom(taskId, "task"), input, { actorUserId: ctx.user.id }) : await createTask(businessId, input, { actorUserId: ctx.user.id });
    revalidate(businessId, task.id, task.jobId);
    return ok({ id: task.id }, taskId ? "Task updated" : "Task created");
  });
}

export async function toggleTaskAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const taskId = idFrom(formData.get("taskId"), "task");
    const ctx = await requireBusinessAccess(businessId, "jobs.manage", { throwOnly: true });
    const task = await setTaskCompleted(businessId, taskId, str(formData.get("completed")) === "true", { actorUserId: ctx.user.id });
    revalidate(businessId, taskId, task.jobId);
    return ok(undefined, task.completedAt ? "Task completed" : "Task reopened");
  });
}

export async function deleteTaskAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const taskId = idFrom(formData.get("taskId"), "task");
    const ctx = await requireBusinessAccess(businessId, "jobs.manage", { throwOnly: true });
    await deleteTask(businessId, taskId, { actorUserId: ctx.user.id });
    revalidate(businessId);
    return ok(undefined, "Task deleted");
  });
}
