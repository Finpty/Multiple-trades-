import type { AuditSeverity, Prisma } from "@prisma/client";
import { platformDb } from "@/lib/db";

/** Platform-wide audit log listing. Only call after `requirePlatformAdmin()`. */

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_SEVERITIES: AuditSeverity[] = ["INFO", "NOTICE", "WARNING", "CRITICAL"];

export interface AuditFilters {
  businessId?: string;
  actor?: string;
  action?: string;
  entityType?: string;
  severity?: string;
  from?: string;
  to?: string;
  page?: number;
}

function parseDate(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) d.setUTCHours(23, 59, 59, 999);
  return d;
}

export async function listAuditLogs(filters: AuditFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.AuditLogWhereInput = {};
  if (filters.businessId) where.businessId = filters.businessId;
  if (filters.actor) where.actor = { email: { contains: filters.actor, mode: "insensitive" } };
  if (filters.action) where.action = { contains: filters.action, mode: "insensitive" };
  if (filters.entityType) where.entityType = { equals: filters.entityType, mode: "insensitive" };
  if (filters.severity && AUDIT_SEVERITIES.includes(filters.severity as AuditSeverity)) where.severity = filters.severity as AuditSeverity;
  const from = parseDate(filters.from);
  const to = parseDate(filters.to, true);
  if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

  const [rows, total, businesses, entityTypes] = await Promise.all([
    platformDb.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      include: { actor: { select: { name: true, email: true } }, business: { select: { name: true } } },
    }),
    platformDb.auditLog.count({ where }),
    platformDb.business.findMany({ where: { deletedAt: undefined }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    platformDb.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
  ]);
  return { rows, total, page, pageSize: AUDIT_PAGE_SIZE, pages: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)), businesses, entityTypes: entityTypes.map((e) => e.entityType) };
}
