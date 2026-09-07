import type { Workflow } from "@prisma/client";
import { formatCents } from "@/lib/money";
import { customerName } from "@/lib/operations/customers";
import { fmtDate } from "@/lib/operations/dates";
import type { JobListRow } from "@/lib/operations/jobs";
import { stagesOf } from "@/lib/operations/workflows";
import { memberById, type MemberOption } from "@/lib/operations/members";
import type { KanbanCard, KanbanColumn } from "./kanban-board";

export function columnsOf(workflow: Pick<Workflow, "stages">): KanbanColumn[] {
  const stages = stagesOf(workflow);
  return stages.map((s, i) => ({ key: s.key, name: s.name, color: s.color ?? "#64748b", isTerminal: !!s.isTerminal || (i === stages.length - 1 && !stages.some((x) => x.isTerminal)), description: s.description }));
}

export function scheduleText(job: { scheduledStart: Date | null; scheduledEnd: Date | null }, timeZone: string): string | null {
  if (!job.scheduledStart && !job.scheduledEnd) return null;
  const start = job.scheduledStart ? fmtDate(job.scheduledStart, timeZone) : "";
  const end = job.scheduledEnd ? fmtDate(job.scheduledEnd, timeZone) : "";
  if (start && end && start !== end) return `${start} → ${end}`;
  return start || end;
}

export function toCard(job: JobListRow, members: MemberOption[], business: { id: string; currency: string; locale: string; timezone: string }): KanbanCard {
  const m = memberById(members, job.assignedToUserId);
  return {
    id: job.id,
    number: job.number,
    title: job.title,
    customer: job.customer ? customerName(job.customer) : null,
    value: job.valueCents ? formatCents(job.valueCents, business.currency, business.locale) : null,
    valueCents: job.valueCents ?? 0,
    schedule: scheduleText(job, business.timezone),
    assignee: m ? { initials: m.initials, name: m.name } : null,
    priority: job.priority,
    stageKey: job.stageKey,
    href: `/admin/${business.id}/jobs/${job.id}`,
  };
}

export function stageName(workflow: Pick<Workflow, "stages">, key: string): string {
  return stagesOf(workflow).find((s) => s.key === key)?.name ?? key;
}
