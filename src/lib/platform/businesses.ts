import type { BusinessStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { platformDb, prisma, tenantDb } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { emitEvent } from "@/lib/events";
import { asObject, toJson } from "@/lib/json";
import { ensureUniqueBusinessSlug } from "@/lib/business/create";
import { isReservedSlug, slugify } from "@/lib/slug";
import { createInviteToken } from "@/lib/auth/service";
import { sendMail } from "@/lib/mail";
import { env } from "@/lib/env";

/**
 * Super Admin business management. Every function assumes
 * `requirePlatformAdmin()` already passed; cross-tenant reads use platformDb
 * and tenant rows are read through `tenantDb(businessId)`.
 */

export const BUSINESS_PAGE_SIZE = 25;
export const BUSINESS_STATUSES: BusinessStatus[] = ["DRAFT", "PUBLISHED", "SUSPENDED", "ARCHIVED"];

export interface BusinessListFilters {
  q?: string;
  status?: string;
  industryId?: string;
  organizationId?: string;
  page?: number;
}

export async function listBusinesses(filters: BusinessListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.BusinessWhereInput = {
    // Archived rows are soft-deleted; include them explicitly so the archive filter works.
    deletedAt: undefined,
  };
  if (filters.q) {
    where.OR = [{ name: { contains: filters.q, mode: "insensitive" } }, { slug: { contains: filters.q, mode: "insensitive" } }];
  }
  if (filters.status && BUSINESS_STATUSES.includes(filters.status as BusinessStatus)) where.status = filters.status as BusinessStatus;
  else if (!filters.status) where.status = { not: "ARCHIVED" };
  if (filters.industryId) where.industryId = filters.industryId;
  if (filters.organizationId) where.organizationId = filters.organizationId;

  const [rows, total, industries, organizations] = await Promise.all([
    platformDb.business.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * BUSINESS_PAGE_SIZE,
      take: BUSINESS_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        publishedAt: true,
        updatedAt: true,
        createdAt: true,
        industry: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
      },
    }),
    platformDb.business.count({ where }),
    prisma.industry.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    platformDb.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { rows, total, page, pageSize: BUSINESS_PAGE_SIZE, pages: Math.max(1, Math.ceil(total / BUSINESS_PAGE_SIZE)), industries, organizations };
}

/** Business header row for the detail layout. Includes archived businesses. */
export async function getBusinessForAdmin(businessId: string) {
  return platformDb.business.findFirst({
    where: { id: businessId, deletedAt: undefined },
    include: { industry: { select: { id: true, name: true, slug: true } }, organization: { select: { id: true, name: true, slug: true, status: true } } },
  });
}

/* ── Details ───────────────────────────────────────────────────────────────── */

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalText = (max: number) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

export const BusinessDetailsSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters")
    .max(60)
    .transform((s) => slugify(s))
    .refine((s) => s.length >= 2, "Slug must contain letters or numbers")
    .refine((s) => !isReservedSlug(s), "This slug is reserved by the platform"),
  legalName: optionalText(160),
  tradingName: optionalText(160),
  businessNumber: optionalText(60),
  taxNumber: optionalText(60),
  phone: optionalText(40),
  email: z.preprocess(emptyToUndefined, z.string().trim().email("Enter a valid email").optional()),
  website: optionalText(200),
  tagline: optionalText(200),
  description: optionalText(4000),
  country: z.string().trim().length(2, "Use a 2-letter country code").toUpperCase(),
  state: optionalText(80),
  timezone: z.string().trim().min(1, "Timezone is required").max(80),
  currency: z.string().trim().length(3, "Use a 3-letter currency code").toUpperCase(),
  locale: z.string().trim().min(2).max(20),
  taxName: z.string().trim().min(1).max(20),
  taxRate: z.coerce.number().min(0).max(100),
  taxInclusive: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  serviceAreaText: optionalText(200),
  industryId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  organizationId: z.string().uuid("Choose an organisation"),
});
export type BusinessDetailsInput = z.output<typeof BusinessDetailsSchema>;

export async function updateBusinessDetails(businessId: string, input: BusinessDetailsInput, actorUserId: string) {
  const before = await platformDb.business.findFirstOrThrow({ where: { id: businessId, deletedAt: undefined } });
  const slug = await ensureUniqueBusinessSlug(input.slug, businessId);
  if (slug !== input.slug) throw new BusinessAdminError(`The slug "${input.slug}" is already taken. Try "${slug}".`);
  if (input.industryId) {
    const industry = await prisma.industry.findFirst({ where: { id: input.industryId }, select: { id: true } });
    if (!industry) throw new BusinessAdminError("Industry not found.");
  }
  const org = await platformDb.organization.findFirst({ where: { id: input.organizationId }, select: { id: true } });
  if (!org) throw new BusinessAdminError("Organisation not found.");

  const data: Prisma.BusinessUncheckedUpdateInput = {
    name: input.name,
    slug,
    legalName: input.legalName ?? null,
    tradingName: input.tradingName ?? null,
    businessNumber: input.businessNumber ?? null,
    taxNumber: input.taxNumber ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    website: input.website ?? null,
    tagline: input.tagline ?? null,
    description: input.description ?? null,
    country: input.country,
    state: input.state ?? null,
    timezone: input.timezone,
    currency: input.currency,
    locale: input.locale,
    taxName: input.taxName,
    taxRate: input.taxRate,
    taxInclusive: input.taxInclusive,
    serviceAreaText: input.serviceAreaText ?? null,
    industryId: input.industryId ?? null,
    organizationId: input.organizationId,
  };
  const after = await platformDb.business.update({ where: { id: businessId }, data });
  const changed = (Object.keys(data) as Array<keyof typeof data>).filter((k) => String((before as Record<string, unknown>)[k as string] ?? "") !== String((after as Record<string, unknown>)[k as string] ?? ""));
  await recordAudit({
    actorUserId,
    organizationId: after.organizationId,
    businessId,
    action: "business.updated",
    entityType: "business",
    entityId: businessId,
    severity: changed.includes("slug") || changed.includes("organizationId") ? "NOTICE" : "INFO",
    before: pickBusinessFields(before),
    after: pickBusinessFields(after),
    metadata: { changed, via: "super-admin" },
  });
  if (changed.length) await emitEvent({ type: "business.updated", businessId, organizationId: after.organizationId, payload: { businessId, fields: changed.map(String) }, actorUserId });
  return after;
}

function pickBusinessFields(b: Record<string, unknown>) {
  const keys = ["name", "slug", "legalName", "tradingName", "businessNumber", "taxNumber", "phone", "email", "website", "tagline", "country", "state", "timezone", "currency", "locale", "taxName", "taxRate", "taxInclusive", "serviceAreaText", "industryId", "organizationId", "status"];
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = b[k] instanceof Object && "toString" in (b[k] as object) && !(b[k] instanceof Date) ? String(b[k]) : b[k];
  return out;
}

export class BusinessAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessAdminError";
  }
}

/* ── Status transitions ────────────────────────────────────────────────────── */

const PREVIOUS_STATUS_KEY = "platform.previousStatus";

export async function suspendBusiness(businessId: string, actorUserId: string, reason?: string) {
  const business = await platformDb.business.findFirstOrThrow({ where: { id: businessId, deletedAt: undefined } });
  if (business.status === "SUSPENDED") throw new BusinessAdminError("This business is already suspended.");
  if (business.status === "ARCHIVED") throw new BusinessAdminError("Restore the business before suspending it.");
  const settings = asObject(business.settings);
  const updated = await platformDb.business.update({
    where: { id: businessId },
    data: { status: "SUSPENDED", settings: toJson({ ...settings, [PREVIOUS_STATUS_KEY]: business.status }) },
  });
  await recordAudit({ actorUserId, organizationId: business.organizationId, businessId, action: "business.suspended", entityType: "business", entityId: businessId, severity: "CRITICAL", before: { status: business.status }, after: { status: "SUSPENDED" }, metadata: { reason: reason ?? null } });
  return updated;
}

export async function unsuspendBusiness(businessId: string, actorUserId: string) {
  const business = await platformDb.business.findFirstOrThrow({ where: { id: businessId, deletedAt: undefined } });
  if (business.status !== "SUSPENDED") throw new BusinessAdminError("This business is not suspended.");
  const settings = asObject(business.settings);
  const previous = settings[PREVIOUS_STATUS_KEY];
  const restored: BusinessStatus = previous === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  const { [PREVIOUS_STATUS_KEY]: _omit, ...rest } = settings;
  void _omit;
  const updated = await platformDb.business.update({ where: { id: businessId }, data: { status: restored, settings: toJson(rest) } });
  await recordAudit({ actorUserId, organizationId: business.organizationId, businessId, action: "business.unsuspended", entityType: "business", entityId: businessId, severity: "CRITICAL", before: { status: "SUSPENDED" }, after: { status: restored } });
  return updated;
}

export async function archiveBusiness(businessId: string, actorUserId: string) {
  const business = await platformDb.business.findFirstOrThrow({ where: { id: businessId, deletedAt: undefined } });
  if (business.status === "ARCHIVED") throw new BusinessAdminError("This business is already archived.");
  const settings = asObject(business.settings);
  const updated = await platformDb.business.update({
    where: { id: businessId },
    data: { status: "ARCHIVED", deletedAt: new Date(), settings: toJson({ ...settings, [PREVIOUS_STATUS_KEY]: business.status === "SUSPENDED" ? settings[PREVIOUS_STATUS_KEY] ?? "DRAFT" : business.status }) },
  });
  await recordAudit({ actorUserId, organizationId: business.organizationId, businessId, action: "business.archived", entityType: "business", entityId: businessId, severity: "CRITICAL", before: { status: business.status }, after: { status: "ARCHIVED" } });
  await emitEvent({ type: "business.archived", businessId, organizationId: business.organizationId, payload: { businessId }, actorUserId });
  return updated;
}

export async function restoreBusiness(businessId: string, actorUserId: string) {
  const business = await platformDb.business.findFirstOrThrow({ where: { id: businessId, deletedAt: { not: null } } });
  const settings = asObject(business.settings);
  const previous = settings[PREVIOUS_STATUS_KEY];
  // A restored site is never re-published implicitly: it comes back as DRAFT
  // unless it was live before, in which case the owner can review then publish.
  const restored: BusinessStatus = previous === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  const { [PREVIOUS_STATUS_KEY]: _omit, ...rest } = settings;
  void _omit;
  const updated = await platformDb.business.update({ where: { id: businessId }, data: { status: restored, deletedAt: null, settings: toJson(rest) } });
  await recordAudit({ actorUserId, organizationId: business.organizationId, businessId, action: "business.restored", entityType: "business", entityId: businessId, severity: "CRITICAL", before: { status: "ARCHIVED" }, after: { status: restored } });
  return updated;
}

/* ── Members ───────────────────────────────────────────────────────────────── */

export async function listBusinessRoles() {
  return prisma.role.findMany({ where: { scope: "BUSINESS" }, orderBy: [{ isSystem: "desc" }, { name: "asc" }], select: { id: true, key: true, name: true, description: true } });
}

export async function listBusinessMembers(businessId: string) {
  return platformDb.businessMembership.findMany({
    where: { businessId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true, status: true, lastLoginAt: true } }, role: { select: { id: true, key: true, name: true } } },
  });
}

export async function addBusinessMember(businessId: string, input: { email: string; name?: string; roleId: string; title?: string }, actorUserId: string) {
  const email = input.email.trim().toLowerCase();
  const business = await platformDb.business.findFirstOrThrow({ where: { id: businessId, deletedAt: undefined }, select: { id: true, name: true, organizationId: true } });
  const role = await prisma.role.findFirst({ where: { id: input.roleId, scope: "BUSINESS" } });
  if (!role) throw new BusinessAdminError("Choose a business role.");

  let user = await prisma.user.findUnique({ where: { email } });
  let created = false;
  if (!user) {
    user = await prisma.user.create({ data: { email, name: input.name?.trim() || email.split("@")[0], status: "INVITED" } });
    created = true;
    await recordAudit({ actorUserId, action: "user.invited", entityType: "user", entityId: user.id, severity: "NOTICE", after: { email, status: "INVITED" }, metadata: { businessId } });
  }
  const existing = await platformDb.businessMembership.findUnique({ where: { businessId_userId: { businessId, userId: user.id } } });
  if (existing) throw new BusinessAdminError("This user is already a member of the business.");

  const membership = await platformDb.businessMembership.create({
    data: {
      businessId,
      userId: user.id,
      roleId: role.id,
      status: user.status === "INVITED" ? "INVITED" : "ACTIVE",
      title: input.title?.trim() || null,
      invitedByUserId: actorUserId,
      invitedAt: new Date(),
      acceptedAt: user.status === "INVITED" ? null : new Date(),
    },
  });

  if (user.status === "INVITED") {
    const url = await createInviteToken(email, { userId: user.id, businessId, roleId: role.id });
    await sendMail({
      to: email,
      subject: `You've been invited to ${business.name}`,
      text: `Hi ${user.name},\n\nYou have been invited to manage ${business.name} on ${env().PLATFORM_URL}.\nSet your password and accept the invitation here:\n${url}\n\nThe link expires in 7 days.`,
    });
  }

  await recordAudit({ actorUserId, organizationId: business.organizationId, businessId, action: "membership.created", entityType: "business_membership", entityId: membership.id, severity: "NOTICE", after: { userId: user.id, email, role: role.key, status: membership.status }, metadata: { userCreated: created } });
  return { membership, user, created };
}

export async function changeBusinessMemberRole(businessId: string, membershipId: string, roleId: string, actorUserId: string) {
  const membership = await platformDb.businessMembership.findFirst({ where: { id: membershipId, businessId }, include: { role: true } });
  if (!membership) throw new BusinessAdminError("Membership not found.");
  const role = await prisma.role.findFirst({ where: { id: roleId, scope: "BUSINESS" } });
  if (!role) throw new BusinessAdminError("Choose a business role.");
  if (role.id === membership.roleId) return membership;
  const updated = await platformDb.businessMembership.update({ where: { id: membershipId }, data: { roleId: role.id } });
  await recordAudit({ actorUserId, businessId, action: "membership.role_changed", entityType: "business_membership", entityId: membershipId, severity: "CRITICAL", before: { role: membership.role.key }, after: { role: role.key }, metadata: { userId: membership.userId } });
  return updated;
}

export async function removeBusinessMember(businessId: string, membershipId: string, actorUserId: string) {
  const membership = await platformDb.businessMembership.findFirst({ where: { id: membershipId, businessId }, include: { role: true, user: { select: { email: true } } } });
  if (!membership) throw new BusinessAdminError("Membership not found.");
  await platformDb.businessMembership.delete({ where: { id: membershipId } });
  await recordAudit({ actorUserId, businessId, action: "membership.removed", entityType: "business_membership", entityId: membershipId, severity: "CRITICAL", before: { userId: membership.userId, email: membership.user.email, role: membership.role.key } });
}

/* ── Related data for detail tabs ──────────────────────────────────────────── */

export async function getBusinessOrganisation(organizationId: string) {
  return platformDb.organization.findFirst({
    where: { id: organizationId, deletedAt: undefined },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      memberships: { include: { user: { select: { id: true, name: true, email: true, status: true } }, role: { select: { key: true, name: true } } }, orderBy: { createdAt: "asc" } },
      businesses: { where: { deletedAt: undefined }, select: { id: true, name: true, slug: true, status: true }, orderBy: { name: "asc" } },
    },
  });
}

export async function getBusinessDomains(businessId: string) {
  return tenantDb(businessId).businessDomain.findMany({ where: { businessId }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] });
}

export async function getBusinessFeatureSummary(businessId: string) {
  const [rows, definitions] = await Promise.all([
    tenantDb(businessId).businessFeature.findMany({ where: { businessId }, select: { featureKey: true, isEnabled: true } }),
    prisma.featureDefinition.findMany({ where: { isActive: true }, select: { key: true, name: true, category: true } }),
  ]);
  const enabled = new Set(rows.filter((r) => r.isEnabled).map((r) => r.featureKey));
  return {
    enabledCount: enabled.size,
    totalDefined: definitions.length,
    features: definitions.map((d) => ({ ...d, isEnabled: enabled.has(d.key) })).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
  };
}

export async function getBusinessSubscriptions(organizationId: string) {
  return platformDb.subscription.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, include: { business: { select: { id: true, name: true } } } });
}

export async function getBusinessRecentAudit(businessId: string, take = 20) {
  return platformDb.auditLog.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, action: true, entityType: true, entityId: true, severity: true, createdAt: true, actor: { select: { name: true, email: true } } },
  });
}

export async function getBusinessRecentEvents(businessId: string, take = 20) {
  return tenantDb(businessId).domainEvent.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take, select: { id: true, type: true, status: true, attempts: true, error: true, createdAt: true, processedAt: true } });
}

export async function getBusinessPrimaryDomain(businessId: string) {
  return tenantDb(businessId).businessDomain.findFirst({ where: { businessId, isPrimary: true, verificationStatus: "VERIFIED" }, select: { hostname: true } });
}

export async function getBusinessCounts(businessId: string) {
  const db = tenantDb(businessId);
  const [pages, services, media, leads, quotes, jobs, members] = await Promise.all([
    db.page.count({ where: { businessId } }),
    db.service.count({ where: { businessId } }),
    db.media.count({ where: { businessId } }),
    db.lead.count({ where: { businessId } }),
    db.quote.count({ where: { businessId } }),
    db.job.count({ where: { businessId } }),
    platformDb.businessMembership.count({ where: { businessId } }),
  ]);
  return { pages, services, media, leads, quotes, jobs, members };
}
