import type { Business } from "@prisma/client";
import { z } from "zod";
import { platformDb } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { recordAudit } from "@/lib/audit";
import { exportBusiness } from "./export";
import { importBusiness, type ImportBusinessResult } from "./import";

/**
 * Duplicate a business inside the platform.
 *
 * Implemented as export → import so duplication, templates and file import
 * share one materialisation path (id remapping, media copying, block props).
 * Media bytes are copied into the new business's own object namespace so the
 * two tenants never share storage objects. Private transactional data
 * (customers, leads, quotes, jobs, invoices, payments, bookings, submissions,
 * messages, audit, events, domains, memberships) is never copied.
 *
 * The new business starts as DRAFT with no domains; the platform admin who
 * duplicated it is not made a member (the platform override applies).
 */
export const DuplicateBusinessOverrides = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(60).optional(),
  legalName: z.string().trim().max(160).optional(),
  tradingName: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().optional(),
  serviceAreaText: z.string().trim().max(200).optional(),
  address: z
    .object({ line1: z.string().optional(), line2: z.string().optional(), city: z.string().optional(), state: z.string().optional(), postcode: z.string().optional(), country: z.string().optional() })
    .optional(),
  /** "same" keeps the source organisation; "new" creates one named organizationName (defaults to the business name). */
  organization: z.enum(["same", "new"]).default("same"),
  organizationName: z.string().trim().max(120).optional(),
  ownerInvite: z.object({ email: z.string().trim().email(), name: z.string().trim().min(1).max(120) }).optional(),
  includeReviews: z.boolean().default(true),
  includeProjects: z.boolean().default(true),
  includeTeam: z.boolean().default(true),
});
export type DuplicateBusinessOverridesInput = z.input<typeof DuplicateBusinessOverrides>;

export class BusinessDuplicateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessDuplicateError";
  }
}

export interface DuplicateResult extends ImportBusinessResult {
  source: Pick<Business, "id" | "name" | "slug">;
}

export async function duplicateBusiness(sourceBusinessId: string, rawOverrides: DuplicateBusinessOverridesInput, ctx: { actorUserId: string }): Promise<DuplicateResult> {
  const overrides = DuplicateBusinessOverrides.parse(rawOverrides);
  const source = await platformDb.business.findFirst({ where: { id: sourceBusinessId, deletedAt: null }, select: { id: true, name: true, slug: true, organizationId: true, industryId: true } });
  if (!source) throw new BusinessDuplicateError("Source business not found.");

  const snapshot = await exportBusiness(sourceBusinessId, { includeProjects: overrides.includeProjects, includeReviews: overrides.includeReviews, resolveMediaUrls: false });

  const result = await importBusiness(snapshot, {
    name: overrides.name,
    slug: overrides.slug,
    organizationId: overrides.organization === "same" ? source.organizationId : undefined,
    organizationName: overrides.organization === "new" ? overrides.organizationName || overrides.name : undefined,
    industryId: source.industryId ?? undefined,
    ownerInvite: overrides.ownerInvite,
    createdByUserId: ctx.actorUserId,
    overrides: {
      legalName: overrides.legalName,
      tradingName: overrides.tradingName,
      phone: overrides.phone,
      email: overrides.email,
      serviceAreaText: overrides.serviceAreaText,
      address: overrides.address,
    },
    includeProjects: overrides.includeProjects,
    includeReviews: overrides.includeReviews,
    includeTeam: overrides.includeTeam,
    mediaSource: "storage",
    auditAction: "business.duplicated",
  });

  await recordAudit({
    actorUserId: ctx.actorUserId,
    organizationId: result.business.organizationId,
    businessId: result.business.id,
    action: "business.duplicated",
    entityType: "business",
    entityId: result.business.id,
    severity: "CRITICAL",
    metadata: { sourceBusinessId: source.id, sourceSlug: source.slug, counts: result.counts, warnings: result.warnings.slice(0, 20), organization: overrides.organization },
  });
  await emitEvent({ type: "business.duplicated", businessId: result.business.id, organizationId: result.business.organizationId, payload: { sourceBusinessId: source.id, businessId: result.business.id }, actorUserId: ctx.actorUserId });

  return { ...result, source };
}
