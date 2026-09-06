import type { Job } from "@prisma/client";
import { tenantDb, withTenantTransaction } from "@/lib/db";
import { emitEvent, flushEvents } from "@/lib/events";
import { asArray } from "@/lib/json";
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
  const workflow = (await db.workflow.findFirst({ where: { businessId, isDefault: true } })) ?? (await db.workflow.findFirst({ where: { businessId } }));
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
