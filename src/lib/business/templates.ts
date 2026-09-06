import type { BusinessTemplate, Prisma } from "@prisma/client";
import { z } from "zod";
import { platformDb, prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { asObject, toJson } from "@/lib/json";
import { isReservedSlug, slugify } from "@/lib/slug";
import { resolveMediaUrl } from "@/lib/storage";
import { exportBusiness, summariseExport, type BusinessExportV1 } from "./export";
import { importBusiness, parseBusinessExport, type ImportBusinessOptions, type ImportBusinessResult, type ParsedBusinessExport } from "./import";

/**
 * Business templates: a saved configuration snapshot (see export.ts) with
 * marketplace metadata. Templates never contain private data — the snapshot
 * is produced by `exportBusiness`, which excludes customers, leads, quotes,
 * jobs, invoices, submissions, messages and audit.
 *
 * All functions assume `requirePlatformAdmin()` already passed.
 */

export class BusinessTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessTemplateError";
  }
}

export const TemplateMetadataSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().max(60).optional(),
  industryId: z.string().uuid().optional(),
  isPremium: z.boolean().default(false),
  priceCents: z.number().int().min(0).max(100_000_000).default(0),
  isActive: z.boolean().default(true),
  /** A media id belonging to the SOURCE business; resolved to a URL on save. */
  previewMediaId: z.string().uuid().optional(),
  previewImageUrl: z.string().max(2000).optional(),
});
export type TemplateMetadataInput = z.input<typeof TemplateMetadataSchema>;

export const TEMPLATE_CATEGORIES = ["starter", "premium", "industry", "seasonal", "regional", "custom"] as const;

async function uniqueTemplateSlug(base: string, excludeId?: string): Promise<string> {
  let candidate = slugify(base) || "template";
  if (isReservedSlug(candidate)) candidate = `${candidate}-template`;
  const root = candidate;
  let i = 2;
  while (true) {
    const existing = await prisma.businessTemplate.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${root}-${i++}`;
  }
}

/** Resolve a media id from the source business into a stable public URL for the template card. */
async function resolvePreviewUrl(sourceBusinessId: string | null, mediaId: string | undefined, fallback: string | null): Promise<string | null> {
  if (!mediaId) return fallback;
  if (!sourceBusinessId) return fallback;
  const media = await platformDb.media.findFirst({ where: { id: mediaId, businessId: sourceBusinessId } });
  if (!media) throw new BusinessTemplateError("The preview image must belong to the template's source business.");
  const variants = asObject<Record<string, { key: string }>>(media.variants);
  const key = variants.medium?.key ?? media.storageKey;
  return resolveMediaUrl({ storageDriver: media.storageDriver, storageKey: key, visibility: media.visibility }, 60 * 60 * 24 * 365);
}

export async function listTemplates(opts: { includeInactive?: boolean } = {}) {
  const rows = await prisma.businessTemplate.findMany({
    where: opts.includeInactive ? {} : { isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { industry: { select: { id: true, name: true, slug: true } }, sourceBusiness: { select: { id: true, name: true, slug: true, deletedAt: true } }, _count: { select: { businesses: true } } },
  });
  return rows.map((t) => ({ ...t, counts: safeSummary(t.snapshot) }));
}

export async function getTemplate(id: string) {
  return prisma.businessTemplate.findFirst({
    where: { id },
    include: { industry: { select: { id: true, name: true, slug: true } }, sourceBusiness: { select: { id: true, name: true, slug: true, deletedAt: true } }, _count: { select: { businesses: true } } },
  });
}

/** Active templates for the wizard picker (no snapshot payload). */
export async function listActiveTemplateCards() {
  const rows = await prisma.businessTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ isPremium: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, description: true, category: true, industryId: true, previewImageUrl: true, isPremium: true, priceCents: true, snapshot: true },
  });
  return rows.map((t) => ({ id: t.id, slug: t.slug, name: t.name, description: t.description, category: t.category, industryId: t.industryId, previewImageUrl: t.previewImageUrl, isPremium: t.isPremium, priceCents: t.priceCents, counts: safeSummary(t.snapshot) }));
}

function safeSummary(snapshot: Prisma.JsonValue): Record<string, number> {
  try {
    return summariseExport(parseBusinessExport(snapshot) as unknown as BusinessExportV1);
  } catch {
    return {};
  }
}

/** Snapshot a business into a new template. Config only — never private records. */
export async function createTemplateFromBusiness(sourceBusinessId: string, meta: TemplateMetadataInput, ctx: { actorUserId: string; includeProjects?: boolean; includeReviews?: boolean }): Promise<BusinessTemplate> {
  const input = TemplateMetadataSchema.parse(meta);
  const source = await platformDb.business.findFirst({ where: { id: sourceBusinessId, deletedAt: null }, select: { id: true, name: true, industryId: true, organizationId: true } });
  if (!source) throw new BusinessTemplateError("Source business not found.");
  const snapshot = await exportBusiness(sourceBusinessId, { includeProjects: ctx.includeProjects ?? false, includeReviews: ctx.includeReviews ?? false, resolveMediaUrls: true });
  const slug = await uniqueTemplateSlug(input.slug || input.name);
  const previewImageUrl = await resolvePreviewUrl(sourceBusinessId, input.previewMediaId, input.previewImageUrl ?? null);
  const template = await prisma.businessTemplate.create({
    data: {
      slug,
      name: input.name,
      description: input.description ?? null,
      category: input.category ?? null,
      industryId: input.industryId ?? source.industryId ?? null,
      previewImageUrl,
      snapshot: toJson(snapshot),
      isPremium: input.isPremium,
      priceCents: input.priceCents,
      isActive: input.isActive,
      sourceBusinessId,
      createdByUserId: ctx.actorUserId,
    },
  });
  await recordAudit({ actorUserId: ctx.actorUserId, organizationId: source.organizationId, businessId: sourceBusinessId, action: "template.created", entityType: "business_template", entityId: template.id, severity: "NOTICE", after: { name: template.name, slug: template.slug, counts: summariseExport(snapshot) } });
  return template;
}

export async function updateTemplateMetadata(templateId: string, meta: TemplateMetadataInput, ctx: { actorUserId: string }): Promise<BusinessTemplate> {
  const input = TemplateMetadataSchema.parse(meta);
  const existing = await prisma.businessTemplate.findFirst({ where: { id: templateId } });
  if (!existing) throw new BusinessTemplateError("Template not found.");
  const slug = input.slug && input.slug !== existing.slug ? await uniqueTemplateSlug(input.slug, templateId) : existing.slug;
  const previewImageUrl = await resolvePreviewUrl(existing.sourceBusinessId, input.previewMediaId, input.previewImageUrl === undefined ? existing.previewImageUrl : input.previewImageUrl || null);
  const updated = await prisma.businessTemplate.update({
    where: { id: templateId },
    data: { name: input.name, slug, description: input.description ?? null, category: input.category ?? null, industryId: input.industryId ?? null, isPremium: input.isPremium, priceCents: input.priceCents, isActive: input.isActive, previewImageUrl },
  });
  await recordAudit({ actorUserId: ctx.actorUserId, action: "template.updated", entityType: "business_template", entityId: templateId, before: { name: existing.name, slug: existing.slug, isActive: existing.isActive, isPremium: existing.isPremium, priceCents: existing.priceCents }, after: { name: updated.name, slug: updated.slug, isActive: updated.isActive, isPremium: updated.isPremium, priceCents: updated.priceCents } });
  return updated;
}

/** Re-export the source business and replace the stored snapshot. */
export async function refreshTemplateSnapshot(templateId: string, ctx: { actorUserId: string; includeProjects?: boolean; includeReviews?: boolean }): Promise<BusinessTemplate> {
  const existing = await prisma.businessTemplate.findFirst({ where: { id: templateId } });
  if (!existing) throw new BusinessTemplateError("Template not found.");
  if (!existing.sourceBusinessId) throw new BusinessTemplateError("This template has no source business to refresh from.");
  const source = await platformDb.business.findFirst({ where: { id: existing.sourceBusinessId, deletedAt: null }, select: { id: true } });
  if (!source) throw new BusinessTemplateError("The source business no longer exists.");
  const previous = safeSummary(existing.snapshot);
  const snapshot = await exportBusiness(existing.sourceBusinessId, { includeProjects: ctx.includeProjects ?? previous.projects > 0, includeReviews: ctx.includeReviews ?? previous.reviews > 0, resolveMediaUrls: true });
  const updated = await prisma.businessTemplate.update({ where: { id: templateId }, data: { snapshot: toJson(snapshot) } });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId: existing.sourceBusinessId, action: "template.snapshot_refreshed", entityType: "business_template", entityId: templateId, severity: "NOTICE", before: previous, after: summariseExport(snapshot) });
  return updated;
}

export async function setTemplateActive(templateId: string, isActive: boolean, ctx: { actorUserId: string }): Promise<void> {
  const existing = await prisma.businessTemplate.findFirst({ where: { id: templateId } });
  if (!existing) throw new BusinessTemplateError("Template not found.");
  await prisma.businessTemplate.update({ where: { id: templateId }, data: { isActive } });
  await recordAudit({ actorUserId: ctx.actorUserId, action: isActive ? "template.activated" : "template.deactivated", entityType: "business_template", entityId: templateId, severity: "NOTICE" });
}

/** Soft delete: hidden everywhere, businesses created from it keep their templateId. */
export async function deleteTemplate(templateId: string, ctx: { actorUserId: string }): Promise<void> {
  const existing = await prisma.businessTemplate.findFirst({ where: { id: templateId } });
  if (!existing) throw new BusinessTemplateError("Template not found.");
  await prisma.businessTemplate.update({ where: { id: templateId }, data: { deletedAt: new Date(), isActive: false } });
  await recordAudit({ actorUserId: ctx.actorUserId, action: "template.deleted", entityType: "business_template", entityId: templateId, severity: "CRITICAL", before: { name: existing.name, slug: existing.slug } });
}

export type TemplateSnapshotOverrides = Partial<Pick<ParsedBusinessExport, "services" | "serviceAreas" | "pricingItems" | "features" | "theme" | "serviceAreaServices" | "serviceMaterials">>;

/**
 * Create a business from a template: the stored snapshot is imported with the
 * details the wizard collected. `snapshotOverrides` lets the wizard replace
 * sections the user edited (services, pricing, areas, features, theme) while
 * everything else (pages, forms, workflows, automations…) comes from the template.
 */
export async function createBusinessFromTemplate(templateId: string, details: Omit<ImportBusinessOptions, "templateId">, snapshotOverrides: TemplateSnapshotOverrides = {}): Promise<ImportBusinessResult> {
  const template = await prisma.businessTemplate.findFirst({ where: { id: templateId, isActive: true } });
  if (!template) throw new BusinessTemplateError("Template not found or inactive.");
  const snapshot = parseBusinessExport(template.snapshot);
  const merged: ParsedBusinessExport = { ...snapshot, ...snapshotOverrides };
  if (snapshotOverrides.services) {
    // Wizard-edited services replace the template's: drop links that pointed at the old ids.
    merged.serviceAreaServices = snapshotOverrides.serviceAreaServices ?? [];
    merged.serviceMaterials = snapshotOverrides.serviceMaterials ?? [];
    merged.projects = merged.projects.map((p) => ({ ...p, serviceIds: [] }));
    merged.workflows = merged.workflows.map((w) => ({ ...w, serviceId: null }));
    merged.pricingRules = merged.pricingRules.map((r) => ({ ...r, serviceId: null }));
    merged.reviews = merged.reviews.map((r) => ({ ...r, serviceId: null }));
  }
  if (snapshotOverrides.serviceAreas) merged.projects = merged.projects.map((p) => ({ ...p, serviceAreaId: null }));
  const result = await importBusiness(merged, { ...details, templateId, industryId: details.industryId ?? template.industryId ?? undefined, auditAction: "business.created_from_template" });
  return result;
}
