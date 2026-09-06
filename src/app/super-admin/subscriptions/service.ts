import type { Prisma, SubscriptionStatus } from "@prisma/client";
import { z } from "zod";
import { platformDb } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { toJson } from "@/lib/json";

/**
 * Subscription management for the Super Admin. Subscriptions belong to an
 * organisation and may optionally be scoped to one of its businesses. All
 * functions assume `requirePlatformAdmin()` has passed.
 */

export const SUBSCRIPTION_PAGE_SIZE = 25;
export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "PAUSED"];
export const SUBSCRIPTION_INTERVALS = ["month", "year", "week", "once"] as const;

export class SubscriptionAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubscriptionAdminError";
  }
}

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());

export const SubscriptionSchema = z.object({
  organizationId: z.string().uuid("Choose an organisation"),
  businessId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  plan: z.string().trim().min(1, "Plan name is required").max(80),
  status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "PAUSED"]),
  seats: z.coerce.number().int().min(1, "At least one seat").max(100000),
  price: z.coerce.number().min(0, "Price cannot be negative").max(10_000_000),
  currency: z.string().trim().length(3, "Use a 3-letter currency code").toUpperCase(),
  interval: z.enum(SUBSCRIPTION_INTERVALS),
  currentPeriodStart: optionalDate,
  currentPeriodEnd: optionalDate,
  trialEndsAt: optionalDate,
  provider: z.preprocess(emptyToUndefined, z.string().trim().max(60).optional()),
  externalId: z.preprocess(emptyToUndefined, z.string().trim().max(160).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
});
export type SubscriptionInput = z.output<typeof SubscriptionSchema>;

export interface SubscriptionListFilters {
  status?: string;
  organizationId?: string;
  q?: string;
  page?: number;
}

export async function listSubscriptions(filters: SubscriptionListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.SubscriptionWhereInput = {};
  if (filters.status && SUBSCRIPTION_STATUSES.includes(filters.status as SubscriptionStatus)) where.status = filters.status as SubscriptionStatus;
  if (filters.organizationId) where.organizationId = filters.organizationId;
  if (filters.q) {
    where.OR = [
      { plan: { contains: filters.q, mode: "insensitive" } },
      { provider: { contains: filters.q, mode: "insensitive" } },
      { externalId: { contains: filters.q, mode: "insensitive" } },
      { organization: { name: { contains: filters.q, mode: "insensitive" } } },
      { business: { name: { contains: filters.q, mode: "insensitive" } } },
    ];
  }
  const [rows, total, byStatus, organizations] = await Promise.all([
    platformDb.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * SUBSCRIPTION_PAGE_SIZE,
      take: SUBSCRIPTION_PAGE_SIZE,
      include: { organization: { select: { id: true, name: true } }, business: { select: { id: true, name: true, slug: true } } },
    }),
    platformDb.subscription.count({ where }),
    platformDb.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
    platformDb.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const counts: Record<string, number> = {};
  for (const g of byStatus) counts[g.status] = g._count._all;
  return { rows, total, page, pageSize: SUBSCRIPTION_PAGE_SIZE, pages: Math.max(1, Math.ceil(total / SUBSCRIPTION_PAGE_SIZE)), counts, organizations };
}

export async function getSubscription(id: string) {
  return platformDb.subscription.findFirst({ where: { id }, include: { organization: { select: { id: true, name: true } }, business: { select: { id: true, name: true, slug: true } } } });
}

/** Organisations with their businesses, for the scope pickers. */
export async function listOrganisationsWithBusinesses() {
  return platformDb.organization.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, businesses: { where: { deletedAt: undefined }, orderBy: { name: "asc" }, select: { id: true, name: true, organizationId: true } } },
  });
}

async function validateScope(input: SubscriptionInput) {
  const org = await platformDb.organization.findFirst({ where: { id: input.organizationId }, select: { id: true } });
  if (!org) throw new SubscriptionAdminError("Organisation not found.");
  if (input.businessId) {
    const business = await platformDb.business.findFirst({ where: { id: input.businessId, deletedAt: undefined }, select: { organizationId: true } });
    if (!business) throw new SubscriptionAdminError("Business not found.");
    if (business.organizationId !== input.organizationId) throw new SubscriptionAdminError("The business must belong to the selected organisation.");
  }
  if (input.currentPeriodStart && input.currentPeriodEnd && input.currentPeriodEnd < input.currentPeriodStart) throw new SubscriptionAdminError("Period end must be after period start.");
}

function toData(input: SubscriptionInput, existingMetadata: Record<string, unknown> = {}): Prisma.SubscriptionUncheckedCreateInput {
  return {
    organizationId: input.organizationId,
    businessId: input.businessId ?? null,
    plan: input.plan,
    status: input.status,
    seats: input.seats,
    priceCents: Math.round(input.price * 100),
    currency: input.currency,
    interval: input.interval,
    currentPeriodStart: input.currentPeriodStart ?? null,
    currentPeriodEnd: input.currentPeriodEnd ?? null,
    trialEndsAt: input.trialEndsAt ?? null,
    provider: input.provider ?? null,
    externalId: input.externalId ?? null,
    metadata: toJson({ ...existingMetadata, notes: input.notes ?? null }),
  };
}

function auditView(s: Prisma.SubscriptionUncheckedCreateInput | { [k: string]: unknown }) {
  const { metadata: _m, ...rest } = s as Record<string, unknown>;
  void _m;
  return rest;
}

export async function createSubscription(input: SubscriptionInput, actorUserId: string) {
  await validateScope(input);
  const data = toData(input);
  if (input.status === "CANCELED") data.canceledAt = new Date();
  const row = await platformDb.subscription.create({ data });
  await recordAudit({ actorUserId, organizationId: row.organizationId, businessId: row.businessId, action: "subscription.created", entityType: "subscription", entityId: row.id, severity: "NOTICE", after: auditView(row) });
  return row;
}

export async function updateSubscription(id: string, input: SubscriptionInput, actorUserId: string) {
  const before = await platformDb.subscription.findFirst({ where: { id } });
  if (!before) throw new SubscriptionAdminError("Subscription not found.");
  await validateScope(input);
  const existingMeta = before.metadata && typeof before.metadata === "object" && !Array.isArray(before.metadata) ? (before.metadata as Record<string, unknown>) : {};
  const data: Prisma.SubscriptionUncheckedUpdateInput = { ...toData(input, existingMeta) };
  if (input.status === "CANCELED" && before.status !== "CANCELED") data.canceledAt = new Date();
  if (input.status !== "CANCELED") data.canceledAt = null;
  const after = await platformDb.subscription.update({ where: { id }, data });
  await recordAudit({ actorUserId, organizationId: after.organizationId, businessId: after.businessId, action: "subscription.updated", entityType: "subscription", entityId: id, severity: "NOTICE", before: auditView(before), after: auditView(after) });
  return after;
}

export async function cancelSubscription(id: string, actorUserId: string, reason?: string) {
  const before = await platformDb.subscription.findFirst({ where: { id } });
  if (!before) throw new SubscriptionAdminError("Subscription not found.");
  if (before.status === "CANCELED") throw new SubscriptionAdminError("This subscription is already cancelled.");
  const existingMeta = before.metadata && typeof before.metadata === "object" && !Array.isArray(before.metadata) ? (before.metadata as Record<string, unknown>) : {};
  const after = await platformDb.subscription.update({ where: { id }, data: { status: "CANCELED", canceledAt: new Date(), metadata: toJson({ ...existingMeta, cancelReason: reason ?? null }) } });
  await recordAudit({ actorUserId, organizationId: after.organizationId, businessId: after.businessId, action: "subscription.canceled", entityType: "subscription", entityId: id, severity: "CRITICAL", before: { status: before.status }, after: { status: "CANCELED" }, metadata: { reason: reason ?? null } });
  return after;
}
