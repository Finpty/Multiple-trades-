import { z } from "zod";
import type { Workflow } from "@prisma/client";
import type { TenantDb } from "@/lib/db";
import { platformDb, tenantDb, withTenantTransaction } from "@/lib/db";
import { asArray, asObject, toJson } from "@/lib/json";
import { recordAudit } from "@/lib/audit";
import type { WorkflowStage } from "./jobs";

export const STAGE_COLORS = ["#64748b", "#0ea5e9", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#f97316", "#a855f7", "#10b981"];

export const StageSchema = z.object({
  key: z.string().min(1, "Key is required").max(40).regex(/^[a-z0-9_]+$/, "Keys use lowercase letters, digits and underscores"),
  name: z.string().min(1, "Stage name is required").max(60),
  color: z.string().max(20).optional(),
  description: z.string().max(300).optional(),
  isTerminal: z.boolean().optional(),
});

export const WorkflowInputSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100),
    key: z.string().min(1, "Key is required").max(40).regex(/^[a-z0-9_]+$/, "Keys use lowercase letters, digits and underscores"),
    description: z.string().max(500).optional(),
    isDefault: z.boolean().default(false),
    serviceId: z.string().uuid().nullable().optional(),
    stages: z.array(StageSchema).min(1, "Add at least one stage"),
    /** removedStageKey → targetStageKey for jobs sitting in a deleted stage */
    stageMoves: z.record(z.string(), z.string()).default({}),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.stages.forEach((s, i) => {
      if (seen.has(s.key)) ctx.addIssue({ code: "custom", path: ["stages", i, "key"], message: `Duplicate stage key "${s.key}"` });
      seen.add(s.key);
    });
  });
export type WorkflowInput = z.infer<typeof WorkflowInputSchema>;

export function slugKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "stage";
}

export function stagesOf(w: Pick<Workflow, "stages">): WorkflowStage[] {
  return asArray<WorkflowStage>(w.stages).filter((s) => s && typeof s.key === "string");
}

export function terminalStageKey(stages: WorkflowStage[]): string | null {
  return stages.find((s) => s.isTerminal)?.key ?? stages[stages.length - 1]?.key ?? null;
}

export interface WorkflowListRow {
  id: string;
  name: string;
  key: string;
  description: string | null;
  isDefault: boolean;
  serviceName: string | null;
  stageCount: number;
  openJobs: number;
  updatedAt: Date;
}

export async function listWorkflows(db: TenantDb, businessId: string): Promise<WorkflowListRow[]> {
  const rows = await db.workflow.findMany({
    where: { businessId, deletedAt: null },
    include: { service: { select: { name: true } }, _count: { select: { jobs: { where: { status: "OPEN", deletedAt: null } } } } },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  return rows.map((w) => ({
    id: w.id,
    name: w.name,
    key: w.key,
    description: w.description,
    isDefault: w.isDefault,
    serviceName: w.service?.name ?? null,
    stageCount: stagesOf(w).length,
    openJobs: w._count.jobs,
    updatedAt: w.updatedAt,
  }));
}

/** Jobs per stage key for one workflow (open jobs only). */
export async function jobsPerStage(db: TenantDb, businessId: string, workflowId: string): Promise<Record<string, number>> {
  const groups = await db.job.groupBy({ by: ["stageKey"], where: { businessId, workflowId, deletedAt: null, status: "OPEN" }, _count: { _all: true } });
  const out: Record<string, number> = {};
  for (const g of groups) out[g.stageKey] = g._count._all;
  return out;
}

export async function saveWorkflow(businessId: string, input: WorkflowInput, workflowId: string | null, actorUserId: string | null): Promise<Workflow> {
  const db = tenantDb(businessId);
  const existing = workflowId ? await db.workflow.findFirst({ where: { id: workflowId, businessId, deletedAt: null } }) : null;
  if (workflowId && !existing) throw new Error("Workflow not found.");
  const clash = await db.workflow.findFirst({ where: { businessId, key: input.key, deletedAt: null, ...(workflowId ? { id: { not: workflowId } } : {}) }, select: { id: true } });
  if (clash) throw new Error(`Another workflow already uses the key "${input.key}".`);
  if (input.serviceId) {
    const svc = await db.service.findFirst({ where: { id: input.serviceId, businessId, deletedAt: null }, select: { id: true } });
    if (!svc) throw new Error("Service not found.");
  }
  const total = await db.workflow.count({ where: { businessId, deletedAt: null } });
  const isDefault = input.isDefault || total === 0 || (!!existing?.isDefault && input.isDefault);
  const stages = input.stages.map((s, i) => ({ key: s.key, name: s.name, color: s.color || STAGE_COLORS[i % STAGE_COLORS.length], description: s.description || undefined, isTerminal: !!s.isTerminal }));
  const newKeys = new Set(stages.map((s) => s.key));

  // Jobs sitting in a removed stage must be moved somewhere that still exists.
  const moves: Array<{ from: string; to: string; jobIds: string[] }> = [];
  if (existing) {
    const removed = stagesOf(existing).filter((s) => !newKeys.has(s.key));
    for (const r of removed) {
      const jobs = await db.job.findMany({ where: { businessId, workflowId: existing.id, stageKey: r.key, deletedAt: null }, select: { id: true } });
      if (jobs.length === 0) continue;
      const target = input.stageMoves[r.key];
      if (!target || !newKeys.has(target)) throw new Error(`Stage "${r.name}" has ${jobs.length} job(s). Choose a stage to move them to before removing it.`);
      moves.push({ from: r.key, to: target, jobIds: jobs.map((j) => j.id) });
    }
  }

  const saved = await withTenantTransaction(businessId, async (tx) => {
    if (isDefault) await tx.workflow.updateMany({ where: { businessId, isDefault: true, ...(workflowId ? { id: { not: workflowId } } : {}) }, data: { isDefault: false } });
    const data = { name: input.name, key: input.key, description: input.description || null, isDefault, serviceId: input.serviceId ?? null, stages: toJson(stages) };
    const row = existing ? await tx.workflow.update({ where: { id: existing.id }, data }) : await tx.workflow.create({ data: { businessId, ...data } });
    for (const m of moves) {
      await tx.job.updateMany({ where: { id: { in: m.jobIds } }, data: { stageKey: m.to, stageChangedAt: new Date() } });
      await tx.jobStageHistory.createMany({ data: m.jobIds.map((jobId) => ({ businessId, jobId, fromStage: m.from, toStage: m.to, changedByUserId: actorUserId, note: `Stage "${m.from}" removed from workflow` })) });
    }
    return row;
  });
  await recordAudit({ actorUserId, businessId, action: existing ? "workflow.updated" : "workflow.created", entityType: "workflow", entityId: saved.id, before: existing ? { name: existing.name, stages: existing.stages } : undefined, after: { name: saved.name, stages, isDefault }, metadata: { moves: moves.map((m) => ({ from: m.from, to: m.to, count: m.jobIds.length })) } });
  return saved;
}

export async function duplicateWorkflow(businessId: string, workflowId: string, actorUserId: string | null): Promise<Workflow> {
  const db = tenantDb(businessId);
  const source = await db.workflow.findFirst({ where: { id: workflowId, businessId, deletedAt: null } });
  if (!source) throw new Error("Workflow not found.");
  let key = `${source.key}_copy`;
  let n = 2;
  while (await db.workflow.findFirst({ where: { businessId, key, deletedAt: null }, select: { id: true } })) key = `${source.key}_copy${n++}`;
  const copy = await db.workflow.create({ data: { businessId, key, name: `${source.name} (copy)`, description: source.description, serviceId: source.serviceId, stages: toJson(stagesOf(source)), isDefault: false } });
  await recordAudit({ actorUserId, businessId, action: "workflow.duplicated", entityType: "workflow", entityId: copy.id, metadata: { sourceId: source.id } });
  return copy;
}

export async function archiveWorkflow(businessId: string, workflowId: string, actorUserId: string | null): Promise<void> {
  const db = tenantDb(businessId);
  const wf = await db.workflow.findFirst({ where: { id: workflowId, businessId, deletedAt: null } });
  if (!wf) throw new Error("Workflow not found.");
  const jobs = await db.job.count({ where: { businessId, workflowId, deletedAt: null } });
  if (jobs > 0) throw new Error(`This workflow is used by ${jobs} job(s). Move or archive those jobs first.`);
  await withTenantTransaction(businessId, async (tx) => {
    await tx.workflow.update({ where: { id: workflowId }, data: { deletedAt: new Date(), isDefault: false } });
    if (wf.isDefault) {
      const next = await tx.workflow.findFirst({ where: { businessId, deletedAt: null, id: { not: workflowId } }, orderBy: { createdAt: "asc" } });
      if (next) await tx.workflow.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
  await recordAudit({ actorUserId, businessId, action: "workflow.archived", entityType: "workflow", entityId: workflowId, before: { name: wf.name } });
}

export async function setDefaultWorkflow(businessId: string, workflowId: string, actorUserId: string | null): Promise<void> {
  await withTenantTransaction(businessId, async (tx) => {
    const wf = await tx.workflow.findFirst({ where: { id: workflowId, businessId, deletedAt: null } });
    if (!wf) throw new Error("Workflow not found.");
    await tx.workflow.updateMany({ where: { businessId, isDefault: true }, data: { isDefault: false } });
    await tx.workflow.update({ where: { id: workflowId }, data: { isDefault: true } });
  });
  await recordAudit({ actorUserId, businessId, action: "workflow.default_changed", entityType: "workflow", entityId: workflowId });
}

const FALLBACK_STAGES: WorkflowStage[] = [
  { key: "lead", name: "Lead", color: "#64748b" },
  { key: "quote", name: "Quote", color: "#8b5cf6" },
  { key: "scheduled", name: "Scheduled", color: "#0ea5e9" },
  { key: "in_progress", name: "In Progress", color: "#f59e0b" },
  { key: "completion", name: "Completion", color: "#10b981", isTerminal: true },
];

/** Creates the business's first workflow from the industry's default stages (or a generic fallback). */
export async function createDefaultWorkflow(businessId: string, actorUserId: string | null): Promise<Workflow> {
  const db = tenantDb(businessId);
  const existing = await db.workflow.findFirst({ where: { businessId, deletedAt: null }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  if (existing) return existing;
  const business = await platformDb.business.findUnique({ where: { id: businessId }, include: { industry: { select: { projectStages: true, terminology: true } } } });
  const industryStages = asArray<WorkflowStage>(business?.industry?.projectStages).filter((s) => s && typeof s.key === "string" && typeof s.name === "string");
  const stages = (industryStages.length ? industryStages : FALLBACK_STAGES).map((s, i) => ({ key: slugKey(s.key), name: s.name, color: s.color || STAGE_COLORS[i % STAGE_COLORS.length], description: s.description, isTerminal: !!s.isTerminal }));
  if (!stages.some((s) => s.isTerminal)) stages[stages.length - 1]!.isTerminal = true;
  const terminology = { ...asObject<Record<string, string>>(business?.industry?.terminology), ...asObject<{ terminology?: Record<string, string> }>(business?.settings).terminology };
  const wf = await db.workflow.create({ data: { businessId, key: "default", name: `${terminology.job ?? "Job"} workflow`, stages: toJson(stages), isDefault: true } });
  await recordAudit({ actorUserId, businessId, action: "workflow.created", entityType: "workflow", entityId: wf.id, after: { name: wf.name, stages }, metadata: { source: "industry_defaults" } });
  return wf;
}
