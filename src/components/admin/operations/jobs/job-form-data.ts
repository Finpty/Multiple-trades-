import type { BusinessContext } from "@/lib/authz";
import { listFieldDefinitions, loadFieldValues } from "@/lib/custom-fields";
import { listCustomerOptions } from "@/lib/operations/customers";
import { listAssignees } from "@/lib/operations/members";
import type { JobFormOption } from "./job-form";

/** Select options shared by the create and edit job forms. */
export async function loadJobFormData(ctx: BusinessContext, opts: { jobId?: string; keepQuoteId?: string | null; keepProjectId?: string | null } = {}) {
  const { businessId, db } = ctx;
  const [workflows, customers, quotes, projects, members, fieldDefs, fieldValues] = await Promise.all([
    db.workflow.findMany({ where: { businessId, deletedAt: null }, orderBy: [{ isDefault: "desc" }, { name: "asc" }], select: { id: true, name: true, isDefault: true } }),
    listCustomerOptions(db, businessId),
    db.quote.findMany({
      where: { businessId, deletedAt: null, OR: [{ status: { in: ["DRAFT", "SENT", "VIEWED", "ACCEPTED"] } }, ...(opts.keepQuoteId ? [{ id: opts.keepQuoteId }] : [])] },
      orderBy: { createdAt: "desc" },
      select: { id: true, number: true, title: true, status: true },
      take: 200,
    }),
    db.project.findMany({
      where: { businessId, deletedAt: null, OR: [{ status: { not: "ARCHIVED" } }, ...(opts.keepProjectId ? [{ id: opts.keepProjectId }] : [])] },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, status: true },
      take: 200,
    }),
    listAssignees(db, businessId, ctx.user),
    listFieldDefinitions(db, businessId, "JOB"),
    opts.jobId ? loadFieldValues(db, opts.jobId) : Promise.resolve({} as Record<string, unknown>),
  ]);
  return {
    workflows: workflows.map<JobFormOption>((w) => ({ id: w.id, label: w.isDefault ? `${w.name} (default)` : w.name })),
    defaultWorkflowId: workflows.find((w) => w.isDefault)?.id ?? workflows[0]?.id ?? "",
    customers,
    quotes: quotes.map<JobFormOption>((q) => ({ id: q.id, label: `${q.number} · ${q.title} (${q.status.toLowerCase()})` })),
    projects: projects.map<JobFormOption>((p) => ({ id: p.id, label: `${p.title} (${p.status.toLowerCase()})` })),
    members: members.map<JobFormOption>((m) => ({ id: m.id, label: m.name })),
    memberOptions: members,
    fieldDefs,
    fieldValues,
  };
}
