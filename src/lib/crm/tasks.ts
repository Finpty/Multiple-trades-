import { z } from "zod";
import type { TenantDb } from "@/lib/db";

/** Task create/complete helpers used from lead and customer detail pages. The tasks page itself lives elsewhere. */

export const TaskInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  description: z.string().trim().max(2000).optional(),
  dueAt: z.string().trim().optional(),
  assignedToUserId: z.string().uuid().optional().or(z.literal("")),
});
export type TaskInput = z.infer<typeof TaskInputSchema>;

export async function createTask(db: TenantDb, businessId: string, target: { leadId?: string | null; customerId?: string | null; jobId?: string | null }, input: TaskInput, source = "crm") {
  const dueAt = input.dueAt && !Number.isNaN(Date.parse(input.dueAt)) ? new Date(input.dueAt) : null;
  return db.task.create({
    data: { businessId, leadId: target.leadId ?? null, customerId: target.customerId ?? null, jobId: target.jobId ?? null, title: input.title, description: input.description || null, dueAt, assignedToUserId: input.assignedToUserId || null, source },
  });
}

export async function completeTask(db: TenantDb, businessId: string, taskId: string, completed: boolean) {
  const task = await db.task.findFirst({ where: { id: taskId, businessId } });
  if (!task) throw new Error("Task not found.");
  return db.task.update({ where: { id: taskId }, data: { completedAt: completed ? new Date() : null } });
}

export async function listTasksFor(db: TenantDb, businessId: string, target: { leadId?: string | null; customerId?: string | null }) {
  const or = [...(target.leadId ? [{ leadId: target.leadId }] : []), ...(target.customerId ? [{ customerId: target.customerId }] : [])];
  if (or.length === 0) return [];
  return db.task.findMany({ where: { businessId, OR: or }, orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }], take: 100 });
}
