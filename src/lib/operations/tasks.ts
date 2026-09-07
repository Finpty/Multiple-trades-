import { z } from "zod";
import type { Prisma, Task } from "@prisma/client";
import type { TenantDb } from "@/lib/db";
import { tenantDb } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

export const TASK_PRIORITIES: Array<{ value: number; label: string }> = [
  { value: 0, label: "Normal" },
  { value: 1, label: "High" },
  { value: 2, label: "Urgent" },
];

export const TaskInputSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(5000).optional(),
  dueAt: z.coerce.date().nullable().optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
  priority: z.coerce.number().int().min(0).max(2).default(0),
  jobId: z.string().uuid().nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
});
export type TaskInput = z.infer<typeof TaskInputSchema>;

export interface TaskListFilter {
  scope?: "open" | "completed";
  due?: "overdue" | "today" | "week" | "";
  assignee?: string; // user id | "all" | "unassigned"
  jobId?: string;
}

export const taskInclude = {
  job: { select: { id: true, number: true, title: true } },
  lead: { select: { id: true, name: true } },
  customer: { select: { id: true, firstName: true, lastName: true, company: true } },
} satisfies Prisma.TaskInclude;
export type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function listTasks(db: TenantDb, businessId: string, f: TaskListFilter = {}): Promise<TaskRow[]> {
  const where: Prisma.TaskWhereInput = { businessId };
  where.completedAt = f.scope === "completed" ? { not: null } : null;
  if (f.assignee === "unassigned") where.assignedToUserId = null;
  else if (f.assignee && f.assignee !== "all") where.assignedToUserId = f.assignee;
  if (f.jobId) where.jobId = f.jobId;
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + 86_400_000);
  if (f.due === "overdue") where.dueAt = { lt: today };
  if (f.due === "today") where.dueAt = { gte: today, lt: tomorrow };
  if (f.due === "week") where.dueAt = { gte: today, lt: new Date(today.getTime() + 7 * 86_400_000) };
  return db.task.findMany({
    where,
    include: taskInclude,
    orderBy: f.scope === "completed" ? [{ completedAt: "desc" }] : [{ dueAt: { sort: "asc", nulls: "last" } }, { priority: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
}

async function assertTaskRefs(db: TenantDb, businessId: string, input: TaskInput) {
  if (input.jobId && !(await db.job.findFirst({ where: { id: input.jobId, businessId }, select: { id: true } }))) throw new Error("Job not found.");
  if (input.leadId && !(await db.lead.findFirst({ where: { id: input.leadId, businessId }, select: { id: true } }))) throw new Error("Lead not found.");
  if (input.customerId && !(await db.customer.findFirst({ where: { id: input.customerId, businessId }, select: { id: true } }))) throw new Error("Customer not found.");
}

function taskData(input: TaskInput) {
  return {
    title: input.title,
    description: input.description || null,
    dueAt: input.dueAt ?? null,
    assignedToUserId: input.assignedToUserId ?? null,
    priority: input.priority,
    jobId: input.jobId ?? null,
    leadId: input.leadId ?? null,
    customerId: input.customerId ?? null,
  };
}

export async function createTask(businessId: string, input: TaskInput, ctx: { actorUserId: string | null; source?: string }): Promise<Task> {
  const db = tenantDb(businessId);
  await assertTaskRefs(db, businessId, input);
  const task = await db.task.create({ data: { businessId, source: ctx.source ?? "manual", ...taskData(input) } });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "task.created", entityType: "task", entityId: task.id, after: { title: task.title, dueAt: task.dueAt } });
  return task;
}

export async function updateTask(businessId: string, taskId: string, input: TaskInput, ctx: { actorUserId: string | null }): Promise<Task> {
  const db = tenantDb(businessId);
  const existing = await db.task.findFirst({ where: { id: taskId, businessId } });
  if (!existing) throw new Error("Task not found.");
  await assertTaskRefs(db, businessId, input);
  const task = await db.task.update({ where: { id: taskId }, data: taskData(input) });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "task.updated", entityType: "task", entityId: task.id, before: { title: existing.title, dueAt: existing.dueAt, assignedToUserId: existing.assignedToUserId }, after: { title: task.title, dueAt: task.dueAt, assignedToUserId: task.assignedToUserId } });
  return task;
}

export async function setTaskCompleted(businessId: string, taskId: string, completed: boolean, ctx: { actorUserId: string | null }): Promise<Task> {
  const db = tenantDb(businessId);
  const existing = await db.task.findFirst({ where: { id: taskId, businessId } });
  if (!existing) throw new Error("Task not found.");
  const task = await db.task.update({ where: { id: taskId }, data: { completedAt: completed ? new Date() : null } });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: completed ? "task.completed" : "task.reopened", entityType: "task", entityId: taskId });
  return task;
}

export async function deleteTask(businessId: string, taskId: string, ctx: { actorUserId: string | null }): Promise<void> {
  const db = tenantDb(businessId);
  const existing = await db.task.findFirst({ where: { id: taskId, businessId } });
  if (!existing) throw new Error("Task not found.");
  await db.task.delete({ where: { id: taskId } });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "task.deleted", entityType: "task", entityId: taskId, before: { title: existing.title, dueAt: existing.dueAt } });
}

export function dueTone(task: Pick<Task, "dueAt" | "completedAt">): "red" | "amber" | "neutral" {
  if (task.completedAt || !task.dueAt) return "neutral";
  const today = startOfDay(new Date());
  if (task.dueAt < today) return "red";
  if (task.dueAt < new Date(today.getTime() + 86_400_000)) return "amber";
  return "neutral";
}
