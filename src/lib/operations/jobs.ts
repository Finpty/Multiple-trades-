import { z } from "zod";
import type { Job, JobStatus, Prisma } from "@prisma/client";
import type { TenantDb } from "@/lib/db";
import { tenantDb, withTenantTransaction } from "@/lib/db";
import { emitEvent, flushEvents } from "@/lib/events";
import { asArray, asObject, toJson } from "@/lib/json";
import { recordAudit } from "@/lib/audit";

export interface WorkflowStage {
  key: string;
  name: string;
  color?: string;
  description?: string;
  isTerminal?: boolean;
}

export async function nextNumber(businessId: string, prefix: string, count: number): Promise<string> {
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

/** Creates a job (and project shell) from an accepted quote. Used by the automation engine and UI. */
export async function createJobFromQuote(businessId: string, quoteId: string, ctx: { actorUserId: string | null }): Promise<Job> {
  const db = tenantDb(businessId);
  const quote = await db.quote.findUniqueOrThrow({ where: { id: quoteId } });
  const existing = await db.job.findFirst({ where: { quoteId } });
  if (existing) return existing;
  const workflow = (await db.workflow.findFirst({ where: { businessId, isDefault: true, deletedAt: null } })) ?? (await db.workflow.findFirst({ where: { businessId, deletedAt: null } }));
  if (!workflow) throw new Error("No workflow configured for this business.");
  const stages = asArray<WorkflowStage>(workflow.stages);
  const firstStage = stages[0]?.key ?? "lead";
  const count = await db.job.count({ where: { businessId } });
  const eventIds: string[] = [];
  const job = await withTenantTransaction(businessId, async (tx) => {
    const created = await tx.job.create({
      data: {
        businessId,
        workflowId: workflow.id,
        customerId: quote.customerId,
        quoteId: quote.id,
        number: await nextNumber(businessId, "JOB", count),
        title: quote.title,
        stageKey: firstStage,
        valueCents: quote.totalCents,
      },
    });
    await tx.jobStageHistory.create({ data: { businessId, jobId: created.id, fromStage: null, toStage: firstStage, changedByUserId: ctx.actorUserId } });
    eventIds.push(await emitEvent({ type: "job.created", businessId, payload: { businessId, jobId: created.id, customerId: quote.customerId }, actorUserId: ctx.actorUserId }, tx));
    return created;
  });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "job.created", entityType: "job", entityId: job.id, metadata: { quoteId } });
  await flushEvents(eventIds);
  return job;
}

export async function moveJobToStage(businessId: string, jobId: string, toStage: string, ctx: { actorUserId: string | null; note?: string }): Promise<Job> {
  const db = tenantDb(businessId);
  const job = await db.job.findUniqueOrThrow({ where: { id: jobId }, include: { workflow: true } });
  const stages = asArray<WorkflowStage>(job.workflow.stages);
  const stage = stages.find((s) => s.key === toStage);
  if (!stage) throw new Error("Unknown workflow stage.");
  const isTerminal = !!stage.isTerminal || stages[stages.length - 1]?.key === toStage;
  const eventIds: string[] = [];
  const updated = await withTenantTransaction(businessId, async (tx) => {
    const u = await tx.job.update({
      where: { id: jobId },
      data: { stageKey: toStage, stageChangedAt: new Date(), ...(isTerminal ? { status: "COMPLETED", completedAt: new Date() } : {}) },
    });
    await tx.jobStageHistory.create({ data: { businessId, jobId, fromStage: job.stageKey, toStage, changedByUserId: ctx.actorUserId, note: ctx.note ?? null } });
    eventIds.push(await emitEvent({ type: "job.stage_changed", businessId, payload: { businessId, jobId, from: job.stageKey, to: toStage, isTerminal }, actorUserId: ctx.actorUserId }, tx));
    if (isTerminal) {
      eventIds.push(await emitEvent({ type: "job.completed", businessId, payload: { businessId, jobId, customerId: job.customerId, projectId: job.projectId }, actorUserId: ctx.actorUserId }, tx));
    }
    return u;
  });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "job.stage_changed", entityType: "job", entityId: jobId, before: { stage: job.stageKey }, after: { stage: toStage } });
  await flushEvents(eventIds);
  return updated;
}

// ── Job CRUD used by the business admin ──────────────────────────────────────

export const JOB_PRIORITIES: Array<{ value: number; label: string }> = [
  { value: 0, label: "Normal" },
  { value: 1, label: "High" },
  { value: 2, label: "Urgent" },
];

export interface JobAddress {
  line1?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
}

export const AddressSchema = z.object({
  line1: z.string().max(200).optional(),
  suburb: z.string().max(100).optional(),
  state: z.string().max(60).optional(),
  postcode: z.string().max(20).optional(),
});

export const JobInputSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(5000).optional(),
  workflowId: z.string().uuid("Choose a workflow"),
  customerId: z.string().uuid().nullable().optional(),
  quoteId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  priority: z.coerce.number().int().min(0).max(2).default(0),
  scheduledStart: z.coerce.date().nullable().optional(),
  scheduledEnd: z.coerce.date().nullable().optional(),
  address: AddressSchema.default({}),
  assignedToUserId: z.string().uuid().nullable().optional(),
  valueCents: z.coerce.number().int().min(0).nullable().optional(),
}).refine((v) => !v.scheduledStart || !v.scheduledEnd || v.scheduledEnd >= v.scheduledStart, { path: ["scheduledEnd"], message: "End must be after start" });
export type JobInput = z.infer<typeof JobInputSchema>;

export function addressText(value: Prisma.JsonValue | JobAddress | null | undefined): string {
  const a = asObject<JobAddress>(value as Prisma.JsonValue);
  return [a.line1, a.suburb, [a.state, a.postcode].filter(Boolean).join(" ")].filter((p) => p && String(p).trim()).join(", ");
}

async function assertJobRefs(db: TenantDb, businessId: string, input: JobInput) {
  const wf = await db.workflow.findFirst({ where: { id: input.workflowId, businessId, deletedAt: null } });
  if (!wf) throw new Error("Workflow not found.");
  if (input.customerId && !(await db.customer.findFirst({ where: { id: input.customerId, businessId, deletedAt: null }, select: { id: true } }))) throw new Error("Customer not found.");
  if (input.quoteId && !(await db.quote.findFirst({ where: { id: input.quoteId, businessId, deletedAt: null }, select: { id: true } }))) throw new Error("Quote not found.");
  if (input.projectId && !(await db.project.findFirst({ where: { id: input.projectId, businessId, deletedAt: null }, select: { id: true } }))) throw new Error("Project not found.");
  return wf;
}

function jobData(input: JobInput) {
  return {
    title: input.title,
    description: input.description || null,
    customerId: input.customerId ?? null,
    quoteId: input.quoteId ?? null,
    projectId: input.projectId ?? null,
    priority: input.priority,
    scheduledStart: input.scheduledStart ?? null,
    scheduledEnd: input.scheduledEnd ?? null,
    address: toJson(input.address),
    assignedToUserId: input.assignedToUserId ?? null,
    valueCents: input.valueCents ?? null,
  };
}

export async function createJob(businessId: string, input: JobInput, ctx: { actorUserId: string | null }): Promise<Job> {
  const db = tenantDb(businessId);
  const wf = await assertJobRefs(db, businessId, input);
  const stages = asArray<WorkflowStage>(wf.stages);
  const firstStage = stages[0]?.key;
  if (!firstStage) throw new Error("The workflow has no stages yet.");
  const count = await db.job.count({ where: { businessId } });
  const eventIds: string[] = [];
  const job = await withTenantTransaction(businessId, async (tx) => {
    const created = await tx.job.create({ data: { businessId, workflowId: wf.id, number: await nextNumber(businessId, "JOB", count), stageKey: firstStage, ...jobData(input) } });
    await tx.jobStageHistory.create({ data: { businessId, jobId: created.id, fromStage: null, toStage: firstStage, changedByUserId: ctx.actorUserId } });
    eventIds.push(await emitEvent({ type: "job.created", businessId, payload: { businessId, jobId: created.id, customerId: created.customerId }, actorUserId: ctx.actorUserId }, tx));
    return created;
  });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "job.created", entityType: "job", entityId: job.id, after: { number: job.number, title: job.title } });
  await flushEvents(eventIds);
  return job;
}

export async function updateJob(businessId: string, jobId: string, input: JobInput, ctx: { actorUserId: string | null }): Promise<Job> {
  const db = tenantDb(businessId);
  const existing = await db.job.findFirst({ where: { id: jobId, businessId, deletedAt: null } });
  if (!existing) throw new Error("Job not found.");
  const wf = await assertJobRefs(db, businessId, input);
  const data: Prisma.JobUncheckedUpdateInput = jobData(input);
  if (wf.id !== existing.workflowId) {
    // Switching workflow: keep the stage if it exists there, otherwise start at the first stage.
    const stages = asArray<WorkflowStage>(wf.stages);
    const keep = stages.some((s) => s.key === existing.stageKey);
    data.workflowId = wf.id;
    if (!keep) {
      data.stageKey = stages[0]?.key ?? existing.stageKey;
      data.stageChangedAt = new Date();
    }
  }
  const updated = await withTenantTransaction(businessId, async (tx) => {
    const u = await tx.job.update({ where: { id: jobId }, data });
    if (data.stageKey && data.stageKey !== existing.stageKey) {
      await tx.jobStageHistory.create({ data: { businessId, jobId, fromStage: existing.stageKey, toStage: String(data.stageKey), changedByUserId: ctx.actorUserId, note: "Workflow changed" } });
    }
    return u;
  });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "job.updated", entityType: "job", entityId: jobId, before: { title: existing.title, valueCents: existing.valueCents, assignedToUserId: existing.assignedToUserId }, after: { title: updated.title, valueCents: updated.valueCents, assignedToUserId: updated.assignedToUserId } });
  return updated;
}

/** Cancel / archive / reopen. Completing a job is done by moving it to a terminal stage. */
export async function setJobStatus(businessId: string, jobId: string, status: JobStatus, ctx: { actorUserId: string | null }): Promise<Job> {
  const db = tenantDb(businessId);
  const existing = await db.job.findFirst({ where: { id: jobId, businessId, deletedAt: null } });
  if (!existing) throw new Error("Job not found.");
  const data: Prisma.JobUncheckedUpdateInput = { status };
  if (status === "ARCHIVED") data.deletedAt = new Date();
  if (status === "OPEN") {
    data.deletedAt = null;
    data.completedAt = null;
  }
  const updated = await db.job.update({ where: { id: jobId }, data });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: `job.${status.toLowerCase()}`, entityType: "job", entityId: jobId, before: { status: existing.status }, after: { status } });
  return updated;
}

export async function restoreJob(businessId: string, jobId: string, ctx: { actorUserId: string | null }): Promise<Job> {
  const db = tenantDb(businessId);
  const existing = await db.job.findFirst({ where: { id: jobId, businessId } });
  if (!existing) throw new Error("Job not found.");
  const updated = await db.job.update({ where: { id: jobId }, data: { status: existing.completedAt ? "COMPLETED" : "OPEN", deletedAt: null } });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "job.restored", entityType: "job", entityId: jobId });
  return updated;
}

export interface JobListFilter {
  workflowId?: string;
  status?: string;
  stage?: string;
  assignee?: string;
  from?: string;
  to?: string;
  q?: string;
  includeArchived?: boolean;
}

export const jobListInclude = {
  customer: { select: { id: true, firstName: true, lastName: true, company: true } },
  workflow: { select: { id: true, name: true, stages: true } },
  _count: { select: { tasks: { where: { completedAt: null } } } },
} satisfies Prisma.JobInclude;

export type JobListRow = Prisma.JobGetPayload<{ include: typeof jobListInclude }>;

export async function listJobs(db: TenantDb, businessId: string, f: JobListFilter = {}): Promise<JobListRow[]> {
  const where: Prisma.JobWhereInput = { businessId };
  if (f.status === "ARCHIVED") where.status = "ARCHIVED";
  else {
    where.deletedAt = null;
    if (f.status && ["OPEN", "COMPLETED", "CANCELED"].includes(f.status)) where.status = f.status as JobStatus;
  }
  if (f.workflowId) where.workflowId = f.workflowId;
  if (f.stage) where.stageKey = f.stage;
  if (f.assignee === "unassigned") where.assignedToUserId = null;
  else if (f.assignee) where.assignedToUserId = f.assignee;
  if (f.from || f.to) {
    where.scheduledStart = {};
    if (f.from && !Number.isNaN(Date.parse(f.from))) where.scheduledStart.gte = new Date(f.from);
    if (f.to && !Number.isNaN(Date.parse(f.to))) where.scheduledStart.lte = new Date(`${f.to}T23:59:59.999Z`);
  }
  if (f.q?.trim()) {
    const q = f.q.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { number: { contains: q, mode: "insensitive" } },
      { customer: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { company: { contains: q, mode: "insensitive" } }] } },
    ];
  }
  return db.job.findMany({ where, include: jobListInclude, orderBy: [{ priority: "desc" }, { stageChangedAt: "desc" }] });
}

/** Creates a DRAFT project from a job (title, location and services from the linked quote/lead) and links it. */
export async function createProjectFromJob(businessId: string, jobId: string, ctx: { actorUserId: string | null }): Promise<{ projectId: string }> {
  const db = tenantDb(businessId);
  const job = await db.job.findFirst({ where: { id: jobId, businessId, deletedAt: null }, include: { quote: { include: { lead: { select: { serviceId: true } } } } } });
  if (!job) throw new Error("Job not found.");
  if (job.projectId) return { projectId: job.projectId };
  const base = job.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "project";
  let slug = base;
  let n = 2;
  while (await db.project.findFirst({ where: { businessId, slug }, select: { id: true } })) slug = `${base}-${n++}`;
  const inputs = asObject<Record<string, unknown>>(job.quote?.inputs);
  const serviceIds = new Set<string>();
  for (const key of ["serviceId", "service"]) if (typeof inputs[key] === "string") serviceIds.add(inputs[key] as string);
  if (job.quote?.lead?.serviceId) serviceIds.add(job.quote.lead.serviceId);
  const validServices = serviceIds.size ? await db.service.findMany({ where: { businessId, id: { in: [...serviceIds] }, deletedAt: null }, select: { id: true } }) : [];
  const projectId = await withTenantTransaction(businessId, async (tx) => {
    const project = await tx.project.create({
      data: {
        businessId,
        title: job.title,
        slug,
        summary: job.description ?? job.quote?.notes ?? null,
        locationText: addressText(job.address) || null,
        status: "DRAFT",
        services: { create: validServices.map((s) => ({ businessId, serviceId: s.id })) },
      },
    });
    await tx.job.update({ where: { id: job.id }, data: { projectId: project.id } });
    await emitEvent({ type: "project.created", businessId, payload: { businessId, projectId: project.id }, actorUserId: ctx.actorUserId }, tx);
    return project.id;
  });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "project.created", entityType: "project", entityId: projectId, metadata: { fromJobId: jobId } });
  return { projectId };
}
