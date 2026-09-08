import type { BusinessContext } from "@/lib/authz";
import { listCustomerOptions } from "@/lib/operations/customers";
import { listAssignees } from "@/lib/operations/members";
import type { TaskFormOption } from "./task-form";

/** Select options for the task form: team, open jobs, open leads, customers. */
export async function loadTaskFormData(ctx: BusinessContext, keep: { jobId?: string | null; leadId?: string | null } = {}) {
  const { businessId, db } = ctx;
  const [members, jobs, leads, customers] = await Promise.all([
    listAssignees(db, businessId, ctx.user),
    db.job.findMany({ where: { businessId, deletedAt: null, OR: [{ status: "OPEN" }, ...(keep.jobId ? [{ id: keep.jobId }] : [])] }, orderBy: { createdAt: "desc" }, select: { id: true, number: true, title: true }, take: 300 }),
    db.lead.findMany({ where: { businessId, deletedAt: null, OR: [{ status: { in: ["NEW", "CONTACTED", "QUALIFIED", "QUOTED"] } }, ...(keep.leadId ? [{ id: keep.leadId }] : [])] }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, status: true }, take: 300 }),
    listCustomerOptions(db, businessId),
  ]);
  return {
    members: members.map<TaskFormOption>((m) => ({ id: m.id, label: m.name })),
    memberOptions: members,
    jobs: jobs.map<TaskFormOption>((j) => ({ id: j.id, label: `${j.number} · ${j.title}` })),
    leads: leads.map<TaskFormOption>((l) => ({ id: l.id, label: `${l.name} (${l.status.toLowerCase()})` })),
    customers: customers.map<TaskFormOption>((c) => ({ id: c.id, label: c.label })),
  };
}
