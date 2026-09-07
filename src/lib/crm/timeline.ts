import type { TenantDb } from "@/lib/db";
import { asObject } from "@/lib/json";
import { listMessages } from "./messages";
import { listTasksFor } from "./tasks";

export type TimelineKind = "note" | "email" | "sms" | "system" | "task" | "audit";

export interface TimelineEntry {
  id: string;
  kind: TimelineKind;
  title: string;
  body: string | null;
  at: Date;
  by: string | null;
  /** Tasks only */
  task?: { id: string; done: boolean; dueAt: Date | null };
}

/** Merged, newest-first activity for a lead and/or customer: messages, tasks and audit entries. */
export async function buildTimeline(db: TenantDb, businessId: string, target: { leadId?: string | null; customerId?: string | null; entityIds?: string[] }): Promise<TimelineEntry[]> {
  const entityIds = target.entityIds ?? [target.leadId, target.customerId].filter((x): x is string => !!x);
  const [messages, tasks, audits] = await Promise.all([
    listMessages(db, businessId, target),
    listTasksFor(db, businessId, target),
    entityIds.length ? db.auditLog.findMany({ where: { businessId, entityId: { in: entityIds } }, orderBy: { createdAt: "desc" }, take: 100, include: { actor: { select: { name: true } } } }) : Promise.resolve([]),
  ]);
  const entries: TimelineEntry[] = [];
  for (const m of messages) {
    const meta = asObject<{ actorName?: string }>(m.metadata);
    const kind: TimelineKind = m.channel === "NOTE" ? "note" : m.channel === "EMAIL" ? "email" : m.channel === "SMS" ? "sms" : "system";
    entries.push({ id: `m_${m.id}`, kind, title: m.channel === "EMAIL" ? `Email ${m.direction === "OUTBOUND" ? "to" : "from"} ${m.toAddress ?? m.fromAddress ?? ""}${m.subject ? ` — ${m.subject}` : ""}` : m.channel === "NOTE" ? "Note" : "System", body: m.body, at: m.createdAt, by: meta.actorName ?? null });
  }
  for (const t of tasks) {
    entries.push({ id: `t_${t.id}`, kind: "task", title: t.title, body: t.description, at: t.createdAt, by: null, task: { id: t.id, done: !!t.completedAt, dueAt: t.dueAt } });
  }
  for (const a of audits) {
    entries.push({ id: `a_${a.id}`, kind: "audit", title: humanizeAction(a.action), body: describeAudit(a.before, a.after), at: a.createdAt, by: a.actor?.name ?? (a.actorType === "API" ? "Website" : a.actorType === "SYSTEM" ? "Automation" : null) });
  }
  return entries.sort((x, y) => y.at.getTime() - x.at.getTime());
}

function humanizeAction(action: string): string {
  const [entity, verb] = action.split(".");
  if (!verb) return action;
  return `${entity.replace(/_/g, " ")} ${verb.replace(/_/g, " ")}`.replace(/^./, (c) => c.toUpperCase());
}

function describeAudit(before: unknown, after: unknown): string | null {
  const b = asObject<Record<string, unknown>>(before as never);
  const a = asObject<Record<string, unknown>>(after as never);
  const parts: string[] = [];
  for (const key of ["status", "assignedToUserId", "customerId"]) {
    if (key in a && (b[key] ?? null) !== (a[key] ?? null)) parts.push(`${key.replace(/([A-Z])/g, " $1").toLowerCase()}: ${String(b[key] ?? "—")} → ${String(a[key] ?? "—")}`);
  }
  return parts.length ? parts.join("; ") : null;
}
