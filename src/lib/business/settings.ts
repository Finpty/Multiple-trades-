import { z } from "zod";
import type { Business, BusinessLocation } from "@prisma/client";
import { platformDb, type TenantDb } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { emitEvent } from "@/lib/events";
import { asObject, toJson } from "@/lib/json";
import { ensureUniqueBusinessSlug } from "@/lib/business/create";
import { isReservedSlug, slugify } from "@/lib/slug";

/** Business-level settings. The businesses row is not RLS-protected, so writes go through platformDb guarded by requireBusinessAccess. */
export const BusinessDetailsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  legalName: z.string().trim().max(160).optional(),
  tradingName: z.string().trim().max(160).optional(),
  businessNumber: z.string().trim().max(60).optional(),
  taxNumber: z.string().trim().max(60).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  website: z.string().trim().max(200).optional(),
  tagline: z.string().trim().max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  foundedYear: z.coerce.number().int().min(1800).max(2100).optional().or(z.literal("")),
  country: z.string().trim().length(2),
  state: z.string().trim().max(80).optional(),
  timezone: z.string().trim().min(1),
  currency: z.string().trim().length(3),
  locale: z.string().trim().min(2).max(20),
  taxName: z.string().trim().max(20),
  taxRate: z.coerce.number().min(0).max(100),
  taxInclusive: z.boolean(),
  serviceAreaText: z.string().trim().max(200).optional(),
});
export type BusinessDetailsInput = z.infer<typeof BusinessDetailsSchema>;

export async function updateBusinessDetails(businessId: string, input: BusinessDetailsInput, actorUserId: string): Promise<Business> {
  const before = await platformDb.business.findUniqueOrThrow({ where: { id: businessId } });
  let slug = before.slug;
  if (input.slug !== before.slug) {
    if (isReservedSlug(input.slug)) throw new Error("That slug is reserved.");
    slug = await ensureUniqueBusinessSlug(input.slug, businessId);
    if (slug !== slugify(input.slug)) throw new Error("That slug is already taken.");
  }
  const empty = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : null);
  const after = await platformDb.business.update({
    where: { id: businessId },
    data: {
      name: input.name,
      slug,
      legalName: empty(input.legalName),
      tradingName: empty(input.tradingName),
      businessNumber: empty(input.businessNumber),
      taxNumber: empty(input.taxNumber),
      phone: empty(input.phone),
      email: empty(input.email || undefined),
      website: empty(input.website),
      tagline: empty(input.tagline),
      description: empty(input.description),
      foundedYear: typeof input.foundedYear === "number" ? input.foundedYear : null,
      country: input.country.toUpperCase(),
      state: empty(input.state),
      timezone: input.timezone,
      currency: input.currency.toUpperCase(),
      locale: input.locale,
      taxName: input.taxName,
      taxRate: input.taxRate,
      taxInclusive: input.taxInclusive,
      serviceAreaText: empty(input.serviceAreaText),
    },
  });
  const changed = (Object.keys(input) as Array<keyof BusinessDetailsInput>).filter((k) => String((before as unknown as Record<string, unknown>)[k] ?? "") !== String((after as unknown as Record<string, unknown>)[k] ?? ""));
  await recordAudit({ actorUserId, businessId, organizationId: before.organizationId, action: "business.updated", entityType: "business", entityId: businessId, before: Object.fromEntries(changed.map((k) => [k, (before as unknown as Record<string, unknown>)[k]])), after: Object.fromEntries(changed.map((k) => [k, (after as unknown as Record<string, unknown>)[k]])), severity: slug !== before.slug ? "NOTICE" : "INFO" });
  await emitEvent({ type: "business.updated", businessId, payload: { businessId, fields: changed.map(String) }, actorUserId });
  return after;
}

/** Arbitrary business.settings keys (terminology, notifications, paymentInstructions, social, estimateDisclaimer …). */
export async function updateBusinessSettings(businessId: string, patch: Record<string, unknown>, actorUserId: string, action = "business.settings.updated"): Promise<Record<string, unknown>> {
  const row = await platformDb.business.findUniqueOrThrow({ where: { id: businessId }, select: { settings: true } });
  const current = asObject<Record<string, unknown>>(row.settings);
  const next = { ...current, ...patch };
  await platformDb.business.update({ where: { id: businessId }, data: { settings: toJson(next) } });
  await recordAudit({ actorUserId, businessId, action, entityType: "business", entityId: businessId, before: Object.fromEntries(Object.keys(patch).map((k) => [k, current[k]])), after: patch });
  return next;
}

export const LocationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  addressLine1: z.string().trim().max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(80).optional(),
  postcode: z.string().trim().max(20).optional(),
  country: z.string().trim().length(2).default("AU"),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  lat: z.coerce.number().min(-90).max(90).optional().or(z.literal("")),
  lng: z.coerce.number().min(-180).max(180).optional().or(z.literal("")),
  serviceRadiusKm: z.coerce.number().int().min(0).max(5000).optional().or(z.literal("")),
  isPrimary: z.boolean().default(false),
  isActive: z.boolean().default(true),
  openingHours: z.array(z.object({ day: z.number().int().min(0).max(6), closed: z.boolean(), open: z.string().max(5), close: z.string().max(5) })).length(7),
});
export type LocationInput = z.infer<typeof LocationSchema>;

export const DEFAULT_HOURS = [1, 2, 3, 4, 5, 6, 0].map((day) => ({ day, closed: day === 0 || day === 6, open: "07:00", close: "17:00" }));

export async function saveLocation(db: TenantDb, businessId: string, input: LocationInput, actorUserId: string, id?: string): Promise<BusinessLocation> {
  const num = (v: number | "" | undefined) => (typeof v === "number" ? v : null);
  const data = {
    businessId,
    name: input.name,
    addressLine1: input.addressLine1 || null,
    addressLine2: input.addressLine2 || null,
    city: input.city || null,
    state: input.state || null,
    postcode: input.postcode || null,
    country: input.country.toUpperCase(),
    phone: input.phone || null,
    email: input.email || null,
    lat: num(input.lat),
    lng: num(input.lng),
    serviceRadiusKm: num(input.serviceRadiusKm),
    isPrimary: input.isPrimary,
    isActive: input.isActive,
    openingHours: toJson(input.openingHours),
  };
  if (input.isPrimary) await db.businessLocation.updateMany({ where: { businessId, ...(id ? { id: { not: id } } : {}) }, data: { isPrimary: false } });
  const row = id ? await db.businessLocation.update({ where: { id }, data }) : await db.businessLocation.create({ data: { ...data, sortOrder: await db.businessLocation.count({ where: { businessId } }) } });
  await recordAudit({ actorUserId, businessId, action: id ? "location.updated" : "location.created", entityType: "business_location", entityId: row.id, after: { name: row.name, isPrimary: row.isPrimary } });
  return row;
}

export async function archiveBusiness(businessId: string, actorUserId: string): Promise<void> {
  const b = await platformDb.business.update({ where: { id: businessId }, data: { status: "ARCHIVED", deletedAt: new Date() } });
  await recordAudit({ actorUserId, businessId, organizationId: b.organizationId, action: "business.archived", entityType: "business", entityId: businessId, severity: "CRITICAL" });
  await emitEvent({ type: "business.archived", businessId, payload: { businessId }, actorUserId });
}

export async function requestBusinessDeletion(businessId: string, actorUserId: string, reason: string): Promise<void> {
  const b = await platformDb.business.findUniqueOrThrow({ where: { id: businessId }, select: { name: true, organizationId: true } });
  await recordAudit({ actorUserId, businessId, organizationId: b.organizationId, action: "business.deletion_requested", entityType: "business", entityId: businessId, severity: "CRITICAL", metadata: { reason } });
  const owners = await platformDb.user.findMany({ where: { platformRole: { in: ["OWNER", "ADMIN"] }, status: "ACTIVE" }, select: { id: true } });
  if (owners.length) await platformDb.notification.createMany({ data: owners.map((o) => ({ userId: o.id, businessId, type: "business.deletion_requested", title: `Deletion requested: ${b.name}`, body: reason.slice(0, 500), data: toJson({ businessId }) })) });
}
