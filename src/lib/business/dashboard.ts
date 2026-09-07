import type { TenantDb } from "@/lib/db";
import { platformDb } from "@/lib/db";
import { asArray } from "@/lib/json";

export interface DashboardData {
  leads30d: number;
  leadsPrev30d: number;
  openQuotes: { count: number; totalCents: number };
  jobsByStage: Array<{ key: string; name: string; color: string; count: number }>;
  upcomingBookings: number;
  newSubmissions: number;
  pageViews30d: number;
  recentActivity: Array<{ id: string; action: string; entityType: string; entityId: string | null; actorName: string | null; createdAt: Date }>;
  recentLeads: Array<{ id: string; name: string; status: string; source: string | null; createdAt: Date }>;
}

const FRIENDLY: Record<string, string> = {
  "business.created": "Business created",
  "business.published": "Website published",
  "business.unpublished": "Website unpublished",
  "page.published": "Page published",
  "theme.published": "Theme published",
  "media.uploaded": "Media uploaded",
  "form.submitted": "Form submitted",
  "lead.created": "Lead created",
  "quote.created": "Quote created",
  "quote.sent": "Quote sent",
  "quote.accepted": "Quote accepted",
  "job.created": "Job created",
  "job.stage_changed": "Job moved",
  "domain.added": "Domain added",
  "domain.verified": "Domain verified",
};

export function friendlyAction(action: string): string {
  return FRIENDLY[action] ?? action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function loadDashboard(db: TenantDb, businessId: string): Promise<DashboardData> {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86_400_000);
  const d60 = new Date(now.getTime() - 60 * 86_400_000);
  const d7 = new Date(now.getTime() + 7 * 86_400_000);
  const [leads30d, leadsPrev30d, openQuotesAgg, workflow, jobs, upcomingBookings, newSubmissions, pageViews30d, audit, recentLeads] = await Promise.all([
    db.lead.count({ where: { businessId, createdAt: { gte: d30 } } }),
    db.lead.count({ where: { businessId, createdAt: { gte: d60, lt: d30 } } }),
    db.quote.aggregate({ where: { businessId, status: { in: ["DRAFT", "SENT", "VIEWED"] } }, _count: { _all: true }, _sum: { totalCents: true } }),
    db.workflow.findFirst({ where: { businessId, isDefault: true } }),
    db.job.groupBy({ by: ["stageKey"], where: { businessId, status: "OPEN" }, _count: { _all: true } }),
    db.booking.count({ where: { businessId, startsAt: { gte: now, lte: d7 }, status: { in: ["REQUESTED", "CONFIRMED"] } } }),
    db.formSubmission.count({ where: { businessId, status: "NEW" } }),
    db.analyticsEvent.count({ where: { businessId, type: "page_view", createdAt: { gte: d30 } } }),
    platformDb.auditLog.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 15, include: { actor: { select: { name: true } } } }),
    db.lead.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, name: true, status: true, source: true, createdAt: true } }),
  ]);
  const stages = asArray<{ key: string; name: string; color?: string }>(workflow?.stages);
  const counts = new Map(jobs.map((j) => [j.stageKey, j._count._all]));
  return {
    leads30d,
    leadsPrev30d,
    openQuotes: { count: openQuotesAgg._count._all, totalCents: openQuotesAgg._sum.totalCents ?? 0 },
    jobsByStage: stages.map((s) => ({ key: s.key, name: s.name, color: s.color ?? "#64748b", count: counts.get(s.key) ?? 0 })),
    upcomingBookings,
    newSubmissions,
    pageViews30d,
    recentActivity: audit.map((a) => ({ id: a.id, action: a.action, entityType: a.entityType, entityId: a.entityId, actorName: a.actor?.name ?? (a.actorType === "SYSTEM" ? "System" : a.actorType === "API" ? "Website" : null), createdAt: a.createdAt })),
    recentLeads,
  };
}
