import { Prisma } from "@prisma/client";
import { platformDb, prisma } from "@/lib/db";
import { env, platformHosts } from "@/lib/env";
import { getPlatformSetting } from "@/lib/platform/settings";

/**
 * Platform-wide reporting helpers for the Super Admin. Every function here
 * uses `platformDb` (RLS bypass) and MUST only be called after
 * `requirePlatformAdmin()` has succeeded.
 */

const DAY_MS = 86_400_000;

export interface PlatformOverview {
  businessesByStatus: Record<string, number>;
  businessesTotal: number;
  organisations: number;
  users: number;
  usersByStatus: Record<string, number>;
  leads30d: number;
  quotes30d: number;
  jobs30d: number;
  publishedSites: number;
  verifiedDomains: number;
  pendingDomainEvents: number;
  failedDomainEvents: number;
  aiEnabled: boolean;
  recentAudit: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    severity: string;
    createdAt: Date;
    actor: { id: string; name: string; email: string } | null;
    business: { id: string; name: string } | null;
  }>;
  recentBusinesses: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    createdAt: Date;
    industry: { name: string } | null;
    organization: { name: string };
  }>;
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const since = new Date(Date.now() - 30 * DAY_MS);
  const [
    businessGroups,
    organisations,
    userGroups,
    leads30d,
    quotes30d,
    jobs30d,
    verifiedDomains,
    pendingDomainEvents,
    failedDomainEvents,
    aiEnabled,
    recentAudit,
    recentBusinesses,
  ] = await Promise.all([
    platformDb.business.groupBy({ by: ["status"], _count: { _all: true }, where: { deletedAt: undefined } }),
    platformDb.organization.count(),
    prisma.user.groupBy({ by: ["status"], _count: { _all: true } }),
    platformDb.lead.count({ where: { createdAt: { gte: since } } }),
    platformDb.quote.count({ where: { createdAt: { gte: since } } }),
    platformDb.job.count({ where: { createdAt: { gte: since } } }),
    platformDb.businessDomain.count({ where: { verificationStatus: "VERIFIED" } }),
    platformDb.domainEvent.count({ where: { status: "PENDING" } }),
    platformDb.domainEvent.count({ where: { status: "FAILED" } }),
    getPlatformSetting<boolean>("ai.enabled", false),
    platformDb.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        severity: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true } },
        business: { select: { id: true, name: true } },
      },
    }),
    platformDb.business.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, name: true, slug: true, status: true, createdAt: true, industry: { select: { name: true } }, organization: { select: { name: true } } },
    }),
  ]);

  const businessesByStatus: Record<string, number> = {};
  let businessesTotal = 0;
  for (const g of businessGroups) {
    businessesByStatus[g.status] = g._count._all;
    businessesTotal += g._count._all;
  }
  const usersByStatus: Record<string, number> = {};
  let users = 0;
  for (const g of userGroups) {
    usersByStatus[g.status] = g._count._all;
    users += g._count._all;
  }

  return {
    businessesByStatus,
    businessesTotal,
    organisations,
    users,
    usersByStatus,
    leads30d,
    quotes30d,
    jobs30d,
    publishedSites: businessesByStatus.PUBLISHED ?? 0,
    verifiedDomains,
    pendingDomainEvents,
    failedDomainEvents,
    aiEnabled: aiEnabled === true,
    recentAudit,
    recentBusinesses,
  };
}

/* ── Analytics ─────────────────────────────────────────────────────────────── */

export interface DailyPoint {
  day: string; // YYYY-MM-DD
  count: number;
}

export interface PlatformAnalytics {
  days: number;
  eventsPerDay: DailyPoint[];
  pageViewsPerDay: DailyPoint[];
  leadsPerDay: DailyPoint[];
  submissionsPerDay: DailyPoint[];
  topBusinesses: Array<{ businessId: string; name: string; slug: string; pageViews: number }>;
  acceptedQuotesByMonth: Array<{ month: string; totalCents: number; count: number; currency: string }>;
  totals: { events: number; pageViews: number; leads: number; submissions: number };
}

function dayKeys(days: number): string[] {
  const out: string[] = [];
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) out.push(new Date(start.getTime() - i * DAY_MS).toISOString().slice(0, 10));
  return out;
}

function fillDays(keys: string[], rows: Array<{ day: string | Date; count: bigint | number }>): DailyPoint[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10);
    map.set(key, Number(r.count));
  }
  return keys.map((day) => ({ day, count: map.get(day) ?? 0 }));
}

type DayRow = { day: Date; count: bigint };

export async function getPlatformAnalytics(days: 7 | 30 | 90): Promise<PlatformAnalytics> {
  const keys = dayKeys(days);
  const since = new Date(`${keys[0]}T00:00:00.000Z`);
  const monthsSince = new Date();
  monthsSince.setUTCDate(1);
  monthsSince.setUTCHours(0, 0, 0, 0);
  monthsSince.setUTCMonth(monthsSince.getUTCMonth() - 11);

  const bypass = Prisma.sql`SELECT set_config('app.bypass_rls', 'on', TRUE)`;
  const [, eventRows, pageViewRows, leadRows, submissionRows, topRows, quoteRows] = await prisma.$transaction([
    prisma.$executeRaw(bypass),
    prisma.$queryRaw<DayRow[]>`SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS day, COUNT(*)::bigint AS count FROM analytics_events WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<DayRow[]>`SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS day, COUNT(*)::bigint AS count FROM analytics_events WHERE "createdAt" >= ${since} AND type = 'page_view' GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<DayRow[]>`SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS day, COUNT(*)::bigint AS count FROM leads WHERE "createdAt" >= ${since} AND "deletedAt" IS NULL GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<DayRow[]>`SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS day, COUNT(*)::bigint AS count FROM form_submissions WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<Array<{ businessId: string; name: string; slug: string; count: bigint }>>`SELECT e."businessId", b.name, b.slug, COUNT(*)::bigint AS count FROM analytics_events e JOIN businesses b ON b.id = e."businessId" WHERE e."createdAt" >= ${since} AND e.type = 'page_view' GROUP BY e."businessId", b.name, b.slug ORDER BY count DESC LIMIT 10`,
    prisma.$queryRaw<Array<{ month: Date; currency: string; total: bigint; count: bigint }>>`SELECT date_trunc('month', "acceptedAt" AT TIME ZONE 'UTC') AS month, currency, COALESCE(SUM("totalCents"), 0)::bigint AS total, COUNT(*)::bigint AS count FROM quotes WHERE "acceptedAt" IS NOT NULL AND "acceptedAt" >= ${monthsSince} AND "deletedAt" IS NULL GROUP BY 1, 2 ORDER BY 1, 2`,
  ]);

  const eventsPerDay = fillDays(keys, eventRows);
  const pageViewsPerDay = fillDays(keys, pageViewRows);
  const leadsPerDay = fillDays(keys, leadRows);
  const submissionsPerDay = fillDays(keys, submissionRows);
  const sum = (points: DailyPoint[]) => points.reduce((a, p) => a + p.count, 0);

  return {
    days,
    eventsPerDay,
    pageViewsPerDay,
    leadsPerDay,
    submissionsPerDay,
    topBusinesses: topRows.map((r) => ({ businessId: r.businessId, name: r.name, slug: r.slug, pageViews: Number(r.count) })),
    acceptedQuotesByMonth: quoteRows.map((r) => ({ month: r.month.toISOString().slice(0, 7), currency: r.currency, totalCents: Number(r.total), count: Number(r.count) })),
    totals: { events: sum(eventsPerDay), pageViews: sum(pageViewsPerDay), leads: sum(leadsPerDay), submissions: sum(submissionsPerDay) },
  };
}

/* ── Infrastructure ────────────────────────────────────────────────────────── */

export interface InfrastructureSummary {
  environment: {
    nodeEnv: string;
    storageDriver: string;
    storagePath: string | null;
    mailDriver: string;
    mailFrom: string;
    platformHosts: string[];
    platformUrl: string;
    databaseHost: string;
    nodeVersion: string;
    uptimeSeconds: number;
  };
  database: {
    ok: boolean;
    error: string | null;
    version: string | null;
    latencyMs: number | null;
    rowCounts: Array<{ table: string; count: number }>;
  };
  migrations: Array<{ id: string; name: string; startedAt: Date; finishedAt: Date | null; appliedStepsCount: number; rolledBackAt: Date | null }>;
  events: {
    pending: number;
    failed: number;
    processed: number;
    retryable: number;
    recentFailed: Array<{ id: string; type: string; businessId: string | null; attempts: number; error: string | null; createdAt: Date; processedAt: Date | null }>;
  };
  maintenance: {
    expiredSessions: number;
    expiredRateLimits: number;
  };
  ai: {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    costMicros: number;
    failed: number;
  };
}

/** Masks credentials and keeps only host[:port]/db from a database URL. */
export function maskDatabaseUrl(url: string): string {
  try {
    const u = new URL(url);
    const db = u.pathname.replace(/^\//, "");
    return `${u.hostname}${u.port ? `:${u.port}` : ""}${db ? `/${db}` : ""}`;
  } catch {
    return "(unparseable)";
  }
}

const COUNTED_TABLES: Array<{ table: string; count: () => Promise<number> }> = [
  { table: "users", count: () => prisma.user.count({ where: { deletedAt: undefined } }) },
  { table: "sessions", count: () => prisma.session.count() },
  { table: "organizations", count: () => platformDb.organization.count({ where: { deletedAt: undefined } }) },
  { table: "businesses", count: () => platformDb.business.count({ where: { deletedAt: undefined } }) },
  { table: "business_domains", count: () => platformDb.businessDomain.count() },
  { table: "industries", count: () => prisma.industry.count({ where: { deletedAt: undefined } }) },
  { table: "pages", count: () => platformDb.page.count({ where: { deletedAt: undefined } }) },
  { table: "services", count: () => platformDb.service.count({ where: { deletedAt: undefined } }) },
  { table: "media", count: () => platformDb.media.count({ where: { deletedAt: undefined } }) },
  { table: "customers", count: () => platformDb.customer.count({ where: { deletedAt: undefined } }) },
  { table: "leads", count: () => platformDb.lead.count({ where: { deletedAt: undefined } }) },
  { table: "quotes", count: () => platformDb.quote.count({ where: { deletedAt: undefined } }) },
  { table: "jobs", count: () => platformDb.job.count({ where: { deletedAt: undefined } }) },
  { table: "invoices", count: () => platformDb.invoice.count({ where: { deletedAt: undefined } }) },
  { table: "form_submissions", count: () => platformDb.formSubmission.count() },
  { table: "domain_events", count: () => platformDb.domainEvent.count() },
  { table: "audit_logs", count: () => platformDb.auditLog.count() },
  { table: "analytics_events", count: () => platformDb.analyticsEvent.count() },
  { table: "ai_usage", count: () => platformDb.aiUsage.count() },
];

export async function getInfrastructureSummary(): Promise<InfrastructureSummary> {
  const e = env();
  const environment: InfrastructureSummary["environment"] = {
    nodeEnv: e.NODE_ENV,
    storageDriver: e.MEDIA_STORAGE_DRIVER,
    storagePath: e.MEDIA_STORAGE_DRIVER === "local" ? e.MEDIA_STORAGE_PATH : e.S3_BUCKET ?? null,
    mailDriver: e.MAIL_DRIVER,
    mailFrom: e.MAIL_FROM,
    platformHosts: platformHosts(),
    platformUrl: e.PLATFORM_URL,
    databaseHost: maskDatabaseUrl(e.DATABASE_URL),
    nodeVersion: process.version,
    uptimeSeconds: Math.round(process.uptime()),
  };

  let database: InfrastructureSummary["database"] = { ok: false, error: null, version: null, latencyMs: null, rowCounts: [] };
  let migrations: InfrastructureSummary["migrations"] = [];
  try {
    const started = Date.now();
    const versionRows = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version()`;
    const latencyMs = Date.now() - started;
    const rowCounts = await Promise.all(COUNTED_TABLES.map(async ({ table, count }) => ({ table, count: await count() })));
    database = { ok: true, error: null, version: versionRows[0]?.version ?? null, latencyMs, rowCounts };
    const rows = await prisma.$queryRaw<Array<{ id: string; migration_name: string; started_at: Date; finished_at: Date | null; applied_steps_count: number; rolled_back_at: Date | null }>>`SELECT id, migration_name, started_at, finished_at, applied_steps_count, rolled_back_at FROM _prisma_migrations ORDER BY started_at ASC`;
    migrations = rows.map((r) => ({ id: r.id, name: r.migration_name, startedAt: r.started_at, finishedAt: r.finished_at, appliedStepsCount: r.applied_steps_count, rolledBackAt: r.rolled_back_at }));
  } catch (error) {
    database = { ...database, ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  const since = new Date(Date.now() - 30 * DAY_MS);
  const [pending, failed, processed, retryable, recentFailed, expiredSessions, expiredRateLimits, aiAgg, aiFailed] = await Promise.all([
    platformDb.domainEvent.count({ where: { status: "PENDING" } }),
    platformDb.domainEvent.count({ where: { status: "FAILED" } }),
    platformDb.domainEvent.count({ where: { status: "PROCESSED" } }),
    platformDb.domainEvent.count({ where: { status: "FAILED", attempts: { lt: 5 } } }),
    platformDb.domainEvent.findMany({
      where: { status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, type: true, businessId: true, attempts: true, error: true, createdAt: true, processedAt: true },
    }),
    prisma.session.count({ where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: new Date(Date.now() - 7 * DAY_MS) } }] } }),
    prisma.rateLimitBucket.count({ where: { resetAt: { lt: new Date() } } }),
    platformDb.aiUsage.aggregate({ where: { createdAt: { gte: since } }, _count: { _all: true }, _sum: { inputTokens: true, outputTokens: true, costMicros: true } }),
    platformDb.aiUsage.count({ where: { createdAt: { gte: since }, status: { not: "ok" } } }),
  ]);

  return {
    environment,
    database,
    migrations,
    events: { pending, failed, processed, retryable, recentFailed },
    maintenance: { expiredSessions, expiredRateLimits },
    ai: {
      requests: aiAgg._count._all,
      inputTokens: aiAgg._sum.inputTokens ?? 0,
      outputTokens: aiAgg._sum.outputTokens ?? 0,
      costMicros: aiAgg._sum.costMicros ?? 0,
      failed: aiFailed,
    },
  };
}

/** Marks every failed event as retryable again and re-dispatches it. */
export async function resetFailedEvents(): Promise<number> {
  const result = await platformDb.domainEvent.updateMany({ where: { status: "FAILED" }, data: { status: "PENDING", attempts: 0, error: null } });
  return result.count;
}
