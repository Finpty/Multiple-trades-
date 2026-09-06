import type { Business, Prisma } from "@prisma/client";
import { z } from "zod";
import { platformDb, withPlatformTransaction } from "@/lib/db";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { asObject, toJson } from "@/lib/json";
import { slugify } from "@/lib/slug";
import { getStorage } from "@/lib/storage";
import { uploadMedia } from "@/lib/media/service";
import { env } from "@/lib/env";
import { ThemeTokensSchema, type ThemeTokens } from "@/lib/theme/tokens";
import { createBusiness, type CreateBusinessInput } from "./create";
import type { BusinessExportV1, ExportMedia } from "./export";

/**
 * Import engine. Materialises a configuration snapshot (from export, a
 * template or duplication) into a brand-new business. Shares the id-remapping
 * logic with duplication so both paths behave identically.
 *
 * Steps:
 *  1. Validate the snapshot leniently (unknown/missing sections are tolerated).
 *  2. Create the shell through `createBusiness` (organisation, business,
 *     location, theme, features) with content generation skipped.
 *  3. Copy media bytes into the new business's object namespace (outside the
 *     transaction; best effort, per file).
 *  4. Insert every content table inside one platform transaction, remapping
 *     ids (services, areas, materials, projects, team, media, pages, forms)
 *     everywhere they are referenced — including inside block props.
 */

/* ───────────────────────── lenient snapshot schema ───────────────────────── */

const Str = z.string().nullable().optional();
const Num = z.number().nullable().optional();
const Bool = (d: boolean) => z.boolean().optional().default(d);
const JsonAny = z.any();
const Id = z.string().min(1);

const SectionSchema = z.object({ type: z.string(), sortOrder: z.number().optional().default(0), props: JsonAny.optional(), settings: JsonAny.optional(), isHidden: z.boolean().optional().default(false) });

export const BusinessExportSchema = z
  .object({
    version: z.number().int().min(1).max(1),
    exportedAt: z.string().optional(),
    platform: z.object({ url: z.string().optional(), storageDriver: z.string().optional() }).partial().optional(),
    business: z
      .object({
        name: z.string().optional(),
        slug: z.string().optional(),
        legalName: Str,
        tradingName: Str,
        businessNumber: Str,
        taxNumber: Str,
        tagline: Str,
        description: Str,
        phone: Str,
        email: Str,
        website: Str,
        foundedYear: Num,
        country: Str,
        state: Str,
        timezone: Str,
        currency: Str,
        locale: Str,
        taxName: Str,
        taxRate: Num,
        taxInclusive: z.boolean().optional(),
        serviceAreaText: Str,
        industrySlug: Str,
        industryName: Str,
        logoMediaId: Str,
        settings: JsonAny.optional(),
        seoDefaults: JsonAny.optional(),
      })
      .passthrough()
      .optional()
      .default({}),
    locations: z.array(z.object({ name: z.string().optional().default("Head office"), isPrimary: Bool(false), addressLine1: Str, addressLine2: Str, city: Str, state: Str, postcode: Str, country: Str, phone: Str, email: Str, openingHours: JsonAny.optional(), serviceRadiusKm: Num, isActive: Bool(true), sortOrder: z.number().optional().default(0) })).optional().default([]),
    theme: z.object({ designFamilySlug: Str, draft: JsonAny.optional() }).optional().default({}),
    features: z.array(z.object({ featureKey: z.string(), isEnabled: z.boolean().optional().default(false), config: JsonAny.optional() })).optional().default([]),
    services: z.array(z.object({ id: Id, parentId: Str, name: z.string(), slug: z.string().optional(), shortDescription: Str, description: Str, icon: Str, pricingMethod: z.string().optional(), priceMinCents: Num, priceMaxCents: Num, priceUnit: Str, ctaLabel: Str, ctaHref: Str, faqs: JsonAny.optional(), seo: JsonAny.optional(), customFields: JsonAny.optional(), featuredMediaId: Str, videoMediaId: Str, gallery: JsonAny.optional(), status: z.string().optional(), isEnabled: Bool(true), isFeatured: Bool(false), sortOrder: z.number().optional().default(0) })).optional().default([]),
    serviceAreas: z.array(z.object({ id: Id, parentId: Str, type: z.string().optional(), name: z.string(), slug: z.string().optional(), postcode: Str, state: Str, country: Str, lat: Num, lng: Num, radiusKm: Num, isPrimary: Bool(false), isEnabled: Bool(true), generatePage: Bool(true), content: JsonAny.optional(), seo: JsonAny.optional(), sortOrder: z.number().optional().default(0) })).optional().default([]),
    serviceAreaServices: z.array(z.object({ serviceAreaId: Id, serviceId: Id })).optional().default([]),
    materials: z.array(z.object({ id: Id, name: z.string(), slug: z.string().optional(), category: Str, description: Str, mediaId: Str, attributes: JsonAny.optional(), sortOrder: z.number().optional().default(0), isActive: Bool(true) })).optional().default([]),
    serviceMaterials: z.array(z.object({ serviceId: Id, materialId: Id })).optional().default([]),
    pages: z.array(z.object({ id: Id, parentId: Str, slug: z.string(), title: z.string(), kind: z.string().optional(), systemKey: Str, templateKey: z.string().optional(), status: z.string().optional(), audience: z.string().optional(), showInNav: Bool(true), sortOrder: z.number().optional().default(0), seo: JsonAny.optional(), settings: JsonAny.optional(), sections: z.array(SectionSchema).optional().default([]) })).optional().default([]),
    navigation: z.array(z.object({ key: z.string(), name: z.string().optional(), draft: JsonAny.optional() })).optional().default([]),
    forms: z.array(z.object({ id: Id.optional(), name: z.string(), slug: z.string(), description: Str, action: z.string().optional(), fields: JsonAny.optional(), settings: JsonAny.optional(), isActive: Bool(true) })).optional().default([]),
    workflows: z.array(z.object({ id: Id.optional(), serviceId: Str, key: z.string(), name: z.string(), description: Str, stages: JsonAny.optional(), isDefault: Bool(false) })).optional().default([]),
    customFieldDefinitions: z.array(z.object({ entityType: z.string(), key: z.string(), label: z.string(), type: z.string(), options: JsonAny.optional(), isRequired: Bool(false), helpText: Str, groupName: Str, defaultValue: JsonAny.optional(), validation: JsonAny.optional(), showOnForms: Bool(false), sortOrder: z.number().optional().default(0), isActive: Bool(true) })).optional().default([]),
    pricingItems: z.array(z.object({ id: Id.optional(), serviceId: Str, key: z.string(), label: z.string(), type: z.string().optional(), amount: z.number(), unit: Str, category: Str, description: Str, sortOrder: z.number().optional().default(0), isActive: Bool(true) })).optional().default([]),
    pricingRules: z.array(z.object({ serviceId: Str, name: z.string(), description: Str, priority: z.number().optional().default(100), conditions: JsonAny.optional(), actions: JsonAny.optional(), isActive: Bool(true) })).optional().default([]),
    automationRules: z.array(z.object({ name: z.string(), description: Str, triggerEvent: z.string(), conditions: JsonAny.optional(), actions: JsonAny.optional(), isActive: Bool(true) })).optional().default([]),
    teamMembers: z.array(z.object({ id: Id, name: z.string(), role: Str, bio: Str, email: Str, phone: Str, mediaId: Str, sortOrder: z.number().optional().default(0), isActive: Bool(true) })).optional().default([]),
    reviews: z.array(z.object({ projectId: Str, serviceId: Str, authorName: z.string(), rating: z.number().int().min(1).max(5), title: Str, body: z.string(), source: Str, reviewedAt: Str, isPublished: Bool(true), isFeatured: Bool(false), sortOrder: z.number().optional().default(0) })).optional().default([]),
    projects: z.array(z.object({ id: Id, serviceAreaId: Str, title: z.string(), slug: z.string().optional(), summary: Str, description: Str, locationText: Str, projectSize: Str, completionDate: Str, challenges: Str, solutions: Str, testimonial: Str, testimonialAuthor: Str, materials: JsonAny.optional(), customFields: JsonAny.optional(), featuredMediaId: Str, videoMediaId: Str, status: z.string().optional(), isFeatured: Bool(false), sortOrder: z.number().optional().default(0), seo: JsonAny.optional(), media: z.array(z.object({ mediaId: Id, stage: z.string().optional(), caption: Str, sortOrder: z.number().optional().default(0) })).optional().default([]), serviceIds: z.array(z.string()).optional().default([]) })).optional().default([]),
    media: z.array(z.object({ id: Id, kind: z.string().optional(), visibility: z.string().optional(), storageDriver: Str, storageKey: Str, filename: Str, originalName: Str, mimeType: z.string().optional(), sizeBytes: Num, width: Num, height: Num, title: Str, altText: Str, caption: Str, tags: JsonAny.optional(), metadata: JsonAny.optional(), variants: JsonAny.optional(), sortOrder: z.number().optional().default(0), downloadUrl: Str })).optional().default([]),
    redirects: z.array(z.object({ fromPath: z.string(), toPath: z.string(), statusCode: z.number().optional().default(301), isActive: Bool(true) })).optional().default([]),
    seoDefaults: JsonAny.optional(),
    settings: z.array(z.object({ key: z.string(), value: JsonAny })).optional().default([]),
  })
  .passthrough();

export type ParsedBusinessExport = z.output<typeof BusinessExportSchema>;

export class BusinessImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessImportError";
  }
}

/** Parse any JSON (string or object) into a validated snapshot. Throws BusinessImportError with a readable message. */
export function parseBusinessExport(raw: unknown): ParsedBusinessExport {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      throw new BusinessImportError("The file is not valid JSON.");
    }
  }
  const parsed = BusinessExportSchema.safeParse(value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new BusinessImportError(`This is not a TRADE ONE business export${first ? ` (${first.path.join(".") || "root"}: ${first.message})` : ""}.`);
  }
  return parsed.data;
}

/* ───────────────────────────── id remapping ─────────────────────────────── */

export interface IdMaps {
  media: Map<string, string>;
  service: Map<string, string>;
  serviceArea: Map<string, string>;
  project: Map<string, string>;
  teamMember: Map<string, string>;
  material: Map<string, string>;
  form: Map<string, string>;
  page: Map<string, string>;
}

export function emptyIdMaps(): IdMaps {
  return { media: new Map(), service: new Map(), serviceArea: new Map(), project: new Map(), teamMember: new Map(), material: new Map(), form: new Map(), page: new Map() };
}

const KEY_TO_MAP: Record<string, keyof IdMaps> = {
  mediaId: "media",
  featuredMediaId: "media",
  videoMediaId: "media",
  posterMediaId: "media",
  logoMediaId: "media",
  secondaryLogoMediaId: "media",
  iconMediaId: "media",
  faviconMediaId: "media",
  backgroundMediaId: "media",
  serviceId: "service",
  projectId: "project",
  serviceAreaId: "serviceArea",
  memberId: "teamMember",
  teamMemberId: "teamMember",
  materialId: "material",
  formId: "form",
  pageId: "page",
};
const ARRAY_KEY_TO_MAP: Record<string, keyof IdMaps> = {
  mediaIds: "media",
  gallery: "media",
  serviceIds: "service",
  projectIds: "project",
  serviceAreaIds: "serviceArea",
  memberIds: "teamMember",
  teamMemberIds: "teamMember",
  materialIds: "material",
  pageIds: "page",
};

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Walks any JSON value (block props, section settings, navigation drafts,
 * theme tokens, form fields…) and rewrites every known id reference through
 * the maps. Unknown ids are dropped (null for media refs, key removed for
 * entity refs, filtered out of arrays) so the new business never points at
 * rows of another tenant.
 */
export function remapJson<T>(value: T, maps: IdMaps): T {
  return walk(value, maps) as T;
}

function walk(value: unknown, maps: IdMaps): unknown {
  if (Array.isArray(value)) return value.map((v) => walk(v, maps));
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const single = KEY_TO_MAP[key];
    if (single && (typeof raw === "string" || raw === null)) {
      if (raw === null) {
        out[key] = null;
        continue;
      }
      const mapped = maps[single].get(raw);
      if (mapped) out[key] = mapped;
      else if (single === "media") out[key] = null;
      else if (!UUID_LIKE.test(raw)) out[key] = raw; // slugs/keys are not ids; keep them
      // otherwise: drop the dangling reference
      continue;
    }
    const list = ARRAY_KEY_TO_MAP[key];
    if (list && Array.isArray(raw)) {
      out[key] = raw
        .map((item) => {
          if (typeof item === "string") return maps[list].get(item) ?? (UUID_LIKE.test(item) ? null : item);
          return walk(item, maps);
        })
        .filter((v) => v !== null && v !== undefined);
      continue;
    }
    out[key] = walk(raw, maps);
  }
  return out;
}

/* ───────────────────────────── media copying ────────────────────────────── */

export type MediaSource = "auto" | "storage" | "download" | "none";

async function readBytesFromStorage(item: ExportMedia | ParsedBusinessExport["media"][number]): Promise<Buffer | null> {
  if (!item.storageDriver || !item.storageKey) return null;
  try {
    const storage = await getStorage(item.storageDriver);
    const object = await storage.get(item.storageKey);
    if (!object) return null;
    return Buffer.concat(await object.body.toArray());
  } catch {
    return null;
  }
}

async function readBytesFromUrl(url: string | null | undefined): Promise<Buffer | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Copies media bytes into the new business's own object namespace so tenants
 * never share objects. Same-platform snapshots read straight from storage;
 * foreign snapshots download from `downloadUrl`. Failures skip the file and
 * are reported as warnings; every reference to a skipped file becomes null.
 */
export async function copyMediaIntoBusiness(businessId: string, snapshot: ParsedBusinessExport, opts: { source: MediaSource; actorUserId: string | null; onlyIds?: Set<string> }): Promise<{ map: Map<string, string>; warnings: string[] }> {
  const map = new Map<string, string>();
  const warnings: string[] = [];
  if (opts.source === "none") return { map, warnings };
  const samePlatform = !snapshot.platform?.url || snapshot.platform.url.replace(/\/$/, "") === env().PLATFORM_URL.replace(/\/$/, "");
  for (const item of snapshot.media) {
    if (opts.onlyIds && !opts.onlyIds.has(item.id)) continue;
    let bytes: Buffer | null = null;
    if ((opts.source === "auto" && samePlatform) || opts.source === "storage") bytes = await readBytesFromStorage(item);
    if (!bytes && (opts.source === "auto" || opts.source === "download")) bytes = await readBytesFromUrl(item.downloadUrl);
    if (!bytes && opts.source === "auto" && !samePlatform) bytes = await readBytesFromStorage(item);
    if (!bytes) {
      warnings.push(`Media "${item.originalName ?? item.filename ?? item.id}" could not be copied and was skipped.`);
      continue;
    }
    try {
      const media = await uploadMedia({
        businessId,
        buffer: bytes,
        originalName: item.originalName ?? item.filename ?? `file-${item.id.slice(0, 8)}`,
        mimeType: item.mimeType ?? "application/octet-stream",
        visibility: item.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC",
        title: item.title ?? null,
        altText: item.altText ?? null,
        caption: item.caption ?? null,
        tags: Array.isArray(item.tags) ? (item.tags as string[]).filter((t) => typeof t === "string") : [],
        uploadedByUserId: opts.actorUserId,
        folderKey: "imported",
      });
      map.set(item.id, media.id);
    } catch (error) {
      warnings.push(`Media "${item.originalName ?? item.id}" was rejected: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { map, warnings };
}

/* ─────────────────────────────── import ─────────────────────────────────── */

export interface ImportBusinessOptions {
  name: string;
  slug?: string;
  organizationId?: string;
  organizationName?: string;
  ownerUserId?: string;
  ownerInvite?: { email: string; name: string };
  createdByUserId: string | null;
  /** Used when the snapshot's industry slug does not exist on this platform. */
  industryId?: string;
  templateId?: string;
  /** Business detail overrides applied on top of the snapshot. */
  overrides?: Partial<Pick<CreateBusinessInput, "legalName" | "tradingName" | "businessNumber" | "taxNumber" | "tagline" | "description" | "phone" | "email" | "website" | "foundedYear" | "country" | "state" | "timezone" | "currency" | "locale" | "taxName" | "taxRate" | "taxInclusive" | "serviceAreaText" | "address">>;
  includeProjects?: boolean;
  includeReviews?: boolean;
  includeTeam?: boolean;
  mediaSource?: MediaSource;
  /** Extra audit context */
  auditAction?: string;
}

export interface ImportBusinessResult {
  business: Business;
  warnings: string[];
  counts: Record<string, number>;
}

const enumOr = <T extends string>(allowed: readonly T[], value: string | null | undefined, fallback: T): T => (value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback);

export async function importBusiness(rawSnapshot: unknown, options: ImportBusinessOptions): Promise<ImportBusinessResult> {
  const snapshot = parseBusinessExport(rawSnapshot);
  const warnings: string[] = [];
  const includeProjects = options.includeProjects ?? true;
  const includeReviews = options.includeReviews ?? true;
  const includeTeam = options.includeTeam ?? true;

  // ── Industry ──────────────────────────────────────────────────────────
  let industryId = options.industryId;
  if (snapshot.business.industrySlug) {
    const bySlug = await prisma.industry.findFirst({ where: { slug: snapshot.business.industrySlug, deletedAt: null }, select: { id: true, isActive: true } });
    if (bySlug?.isActive) industryId = industryId ?? bySlug.id;
    else if (!industryId) warnings.push(`Industry "${snapshot.business.industrySlug}" does not exist on this platform; choose one when importing.`);
  }
  if (!industryId) {
    const fallback = await prisma.industry.findFirst({ where: { isActive: true, deletedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true } });
    if (!fallback) throw new BusinessImportError("No active industry is available to import into.");
    industryId = fallback.id;
  }

  // ── Theme + features from the snapshot ────────────────────────────────
  const rawTheme = asObject<Partial<ThemeTokens>>((snapshot.theme.draft ?? null) as Prisma.JsonValue);
  const themeParse = ThemeTokensSchema.partial().safeParse({ ...rawTheme, logoMediaId: null, secondaryLogoMediaId: null, iconMediaId: null, faviconMediaId: null });
  const themeOverrides = themeParse.success ? themeParse.data : undefined;
  if (!themeParse.success) warnings.push("The theme in the snapshot was invalid and the design family defaults were used instead.");
  const designFamilySlug = snapshot.theme.designFamilySlug ?? undefined;
  if (designFamilySlug && !(await prisma.designFamily.findUnique({ where: { slug: designFamilySlug }, select: { id: true } }))) warnings.push(`Design family "${designFamilySlug}" is not available; the default family was used.`);
  const features = snapshot.features.filter((f) => f.isEnabled).map((f) => f.featureKey);

  const b = snapshot.business;
  const o = options.overrides ?? {};
  const primaryLocation = snapshot.locations.find((l) => l.isPrimary) ?? snapshot.locations[0];
  const address = o.address ?? (primaryLocation ? { line1: primaryLocation.addressLine1 ?? undefined, line2: primaryLocation.addressLine2 ?? undefined, city: primaryLocation.city ?? undefined, state: primaryLocation.state ?? undefined, postcode: primaryLocation.postcode ?? undefined, country: primaryLocation.country ?? undefined } : undefined);

  const business = await createBusiness({
    organizationId: options.organizationId,
    organizationName: options.organizationName,
    industryId,
    templateId: options.templateId,
    name: options.name,
    slug: options.slug,
    legalName: o.legalName ?? b.legalName ?? undefined,
    tradingName: o.tradingName ?? b.tradingName ?? undefined,
    businessNumber: o.businessNumber ?? b.businessNumber ?? undefined,
    taxNumber: o.taxNumber ?? b.taxNumber ?? undefined,
    tagline: o.tagline ?? b.tagline ?? undefined,
    description: o.description ?? b.description ?? undefined,
    phone: o.phone ?? b.phone ?? undefined,
    email: o.email ?? (b.email && z.string().email().safeParse(b.email).success ? b.email : undefined),
    website: o.website ?? b.website ?? undefined,
    foundedYear: o.foundedYear ?? b.foundedYear ?? undefined,
    country: o.country ?? (b.country && b.country.length === 2 ? b.country : "AU"),
    state: o.state ?? b.state ?? undefined,
    timezone: o.timezone ?? b.timezone ?? undefined,
    currency: o.currency ?? (b.currency && b.currency.length === 3 ? b.currency : undefined),
    locale: o.locale ?? b.locale ?? undefined,
    taxName: o.taxName ?? b.taxName ?? undefined,
    taxRate: o.taxRate ?? b.taxRate ?? undefined,
    taxInclusive: o.taxInclusive ?? b.taxInclusive ?? undefined,
    serviceAreaText: o.serviceAreaText ?? b.serviceAreaText ?? undefined,
    address,
    designFamilySlug,
    themeOverrides,
    features: features.length ? features : undefined,
    ownerUserId: options.ownerUserId,
    ownerInvite: options.ownerUserId ? undefined : options.ownerInvite,
    createdByUserId: options.createdByUserId,
    skipContentGeneration: true,
  });
  const businessId = business.id;

  // ── Media (outside the transaction) ───────────────────────────────────
  const referenced = collectReferencedMediaIds(snapshot, { includeProjects, includeTeam });
  const mediaCopy = await copyMediaIntoBusiness(businessId, snapshot, { source: options.mediaSource ?? "auto", actorUserId: options.createdByUserId, onlyIds: referenced.size ? undefined : undefined });
  warnings.push(...mediaCopy.warnings);
  const maps = emptyIdMaps();
  maps.media = mediaCopy.map;

  // ── Content (one transaction) ─────────────────────────────────────────
  const counts = await withPlatformTransaction(
    async (tx) => {
      const counts: Record<string, number> = {};

      // Services (parents before children)
      const serviceSlugs = new Set<string>();
      for (const s of orderByParent(snapshot.services)) {
        const parentId = s.parentId ? maps.service.get(s.parentId) ?? null : null;
        const slug = uniqueIn(serviceSlugs, s.slug || slugify(s.name));
        const row = await tx.service.create({
          data: {
            businessId,
            parentId,
            name: s.name,
            slug,
            shortDescription: s.shortDescription ?? null,
            description: s.description ?? null,
            icon: s.icon ?? null,
            pricingMethod: enumOr(["QUOTE", "FIXED", "RANGE", "HOURLY", "DAY_RATE", "PER_SQM", "PER_UNIT", "PER_LINEAR_METRE"] as const, s.pricingMethod, "QUOTE"),
            priceMinCents: s.priceMinCents ?? null,
            priceMaxCents: s.priceMaxCents ?? null,
            priceUnit: s.priceUnit ?? null,
            ctaLabel: s.ctaLabel ?? null,
            ctaHref: s.ctaHref ?? null,
            faqs: toJson(s.faqs ?? []),
            seo: toJson(s.seo ?? {}),
            customFields: toJson(s.customFields ?? {}),
            featuredMediaId: mapOrNull(maps.media, s.featuredMediaId),
            videoMediaId: mapOrNull(maps.media, s.videoMediaId),
            gallery: toJson(mapList(maps.media, s.gallery)),
            status: enumOr(["DRAFT", "PUBLISHED", "ARCHIVED"] as const, s.status, "PUBLISHED"),
            isEnabled: s.isEnabled,
            isFeatured: s.isFeatured,
            sortOrder: s.sortOrder,
          },
        });
        maps.service.set(s.id, row.id);
      }
      counts.services = maps.service.size;

      // Service areas
      const areaSlugs = new Set<string>();
      for (const a of orderByParent(snapshot.serviceAreas)) {
        const row = await tx.serviceArea.create({
          data: {
            businessId,
            parentId: a.parentId ? maps.serviceArea.get(a.parentId) ?? null : null,
            type: enumOr(["COUNTRY", "STATE", "REGION", "CITY", "SUBURB", "POSTCODE"] as const, a.type, "SUBURB"),
            name: a.name,
            slug: uniqueIn(areaSlugs, a.slug || slugify(a.name)),
            postcode: a.postcode ?? null,
            state: a.state ?? null,
            country: a.country ?? business.country,
            lat: a.lat ?? null,
            lng: a.lng ?? null,
            radiusKm: a.radiusKm ?? null,
            isPrimary: a.isPrimary,
            isEnabled: a.isEnabled,
            generatePage: a.generatePage,
            content: toJson(a.content ?? {}),
            seo: toJson(a.seo ?? {}),
            sortOrder: a.sortOrder,
          },
        });
        maps.serviceArea.set(a.id, row.id);
      }
      counts.serviceAreas = maps.serviceArea.size;

      // Materials
      const materialSlugs = new Set<string>();
      for (const m of snapshot.materials) {
        const row = await tx.material.create({ data: { businessId, name: m.name, slug: uniqueIn(materialSlugs, m.slug || slugify(m.name)), category: m.category ?? null, description: m.description ?? null, mediaId: mapOrNull(maps.media, m.mediaId), attributes: toJson(m.attributes ?? {}), sortOrder: m.sortOrder, isActive: m.isActive } });
        maps.material.set(m.id, row.id);
      }
      counts.materials = maps.material.size;

      // Join tables
      const areaLinks = snapshot.serviceAreaServices.map((x) => ({ businessId, serviceAreaId: maps.serviceArea.get(x.serviceAreaId), serviceId: maps.service.get(x.serviceId) })).filter((x): x is { businessId: string; serviceAreaId: string; serviceId: string } => !!x.serviceAreaId && !!x.serviceId);
      if (areaLinks.length) await tx.serviceAreaService.createMany({ data: areaLinks, skipDuplicates: true });
      const materialLinks = snapshot.serviceMaterials.map((x) => ({ serviceId: maps.service.get(x.serviceId), materialId: maps.material.get(x.materialId) })).filter((x): x is { serviceId: string; materialId: string } => !!x.serviceId && !!x.materialId);
      if (materialLinks.length) await tx.serviceMaterial.createMany({ data: materialLinks, skipDuplicates: true });

      // Forms
      const formSlugs = new Set<string>();
      for (const f of snapshot.forms) {
        const row = await tx.form.create({ data: { businessId, name: f.name, slug: uniqueIn(formSlugs, f.slug || slugify(f.name)), description: f.description ?? null, action: enumOr(["LEAD", "QUOTE_REQUEST", "BOOKING_REQUEST", "CONTACT", "PROJECT_REQUEST"] as const, f.action, "LEAD"), fields: toJson(remapJson(f.fields ?? [], maps)), settings: toJson(f.settings ?? {}), isActive: f.isActive } });
        if (f.id) maps.form.set(f.id, row.id);
      }
      counts.forms = snapshot.forms.length;

      // Workflows
      const workflowKeys = new Set<string>();
      let hasDefaultWorkflow = false;
      for (const w of snapshot.workflows) {
        const isDefault = w.isDefault && !hasDefaultWorkflow;
        if (isDefault) hasDefaultWorkflow = true;
        await tx.workflow.create({ data: { businessId, serviceId: mapOrNull(maps.service, w.serviceId), key: uniqueIn(workflowKeys, w.key || slugify(w.name)), name: w.name, description: w.description ?? null, stages: toJson(w.stages ?? []), isDefault } });
      }
      if (!hasDefaultWorkflow) {
        const first = await tx.workflow.findFirst({ where: { businessId }, orderBy: { createdAt: "asc" } });
        if (first) await tx.workflow.update({ where: { id: first.id }, data: { isDefault: true } });
        else await tx.workflow.create({ data: { businessId, key: "default", name: "Job workflow", isDefault: true, stages: toJson([{ key: "lead", name: "Lead" }, { key: "quote", name: "Quote" }, { key: "in_progress", name: "In Progress" }, { key: "completion", name: "Completion", isTerminal: true }]) } });
      }
      counts.workflows = Math.max(snapshot.workflows.length, 1);

      // Custom fields
      const fieldRows: Prisma.CustomFieldDefinitionCreateManyInput[] = snapshot.customFieldDefinitions.map((c, i) => ({
        businessId,
        entityType: enumOr(["BUSINESS", "SERVICE", "PROJECT", "CUSTOMER", "LEAD", "QUOTE", "ESTIMATE", "JOB"] as const, c.entityType, "JOB"),
        key: c.key,
        label: c.label,
        type: enumOr(["TEXT", "TEXTAREA", "RICHTEXT", "NUMBER", "MEASUREMENT", "SELECT", "MULTISELECT", "BOOLEAN", "DATE", "TIME", "EMAIL", "PHONE", "URL", "MEDIA", "ADDRESS"] as const, c.type, "TEXT"),
        options: toJson(c.options ?? []),
        isRequired: c.isRequired,
        helpText: c.helpText ?? null,
        groupName: c.groupName ?? null,
        defaultValue: c.defaultValue === undefined || c.defaultValue === null ? undefined : toJson(c.defaultValue),
        validation: toJson(c.validation ?? {}),
        showOnForms: c.showOnForms,
        sortOrder: c.sortOrder ?? i,
        isActive: c.isActive,
      }));
      if (fieldRows.length) await tx.customFieldDefinition.createMany({ data: fieldRows, skipDuplicates: true });
      counts.customFields = fieldRows.length;

      // Pricing
      const pricingKeys = new Set<string>();
      for (const p of snapshot.pricingItems) {
        await tx.pricingItem.create({ data: { businessId, serviceId: mapOrNull(maps.service, p.serviceId), key: uniqueIn(pricingKeys, p.key), label: p.label, type: enumOr(["RATE", "FEE", "MULTIPLIER", "PERCENT"] as const, p.type, "RATE"), amount: p.amount, unit: p.unit ?? null, category: p.category ?? null, description: p.description ?? null, sortOrder: p.sortOrder, isActive: p.isActive } });
      }
      counts.pricingItems = snapshot.pricingItems.length;
      if (snapshot.pricingRules.length) {
        await tx.pricingRule.createMany({ data: snapshot.pricingRules.map((r) => ({ businessId, serviceId: mapOrNull(maps.service, r.serviceId), name: r.name, description: r.description ?? null, priority: r.priority, conditions: toJson(remapJson(r.conditions ?? {}, maps)), actions: toJson(remapJson(r.actions ?? [], maps)), isActive: r.isActive })) });
      }
      counts.pricingRules = snapshot.pricingRules.length;

      // Automations
      if (snapshot.automationRules.length) {
        await tx.automationRule.createMany({ data: snapshot.automationRules.map((r) => ({ businessId, name: r.name, description: r.description ?? null, triggerEvent: r.triggerEvent, conditions: toJson(remapJson(r.conditions ?? {}, maps)), actions: toJson(remapJson(r.actions ?? [], maps)), isActive: r.isActive })) });
      }
      counts.automationRules = snapshot.automationRules.length;

      // Team
      if (includeTeam) {
        for (const t of snapshot.teamMembers) {
          const row = await tx.teamMember.create({ data: { businessId, name: t.name, role: t.role ?? null, bio: t.bio ?? null, email: t.email ?? null, phone: t.phone ?? null, mediaId: mapOrNull(maps.media, t.mediaId), sortOrder: t.sortOrder, isActive: t.isActive } });
          maps.teamMember.set(t.id, row.id);
        }
      }
      counts.teamMembers = maps.teamMember.size;

      // Projects (+ media, services)
      if (includeProjects) {
        const projectSlugs = new Set<string>();
        for (const p of snapshot.projects) {
          const row = await tx.project.create({
            data: {
              businessId,
              serviceAreaId: mapOrNull(maps.serviceArea, p.serviceAreaId),
              title: p.title,
              slug: uniqueIn(projectSlugs, p.slug || slugify(p.title)),
              summary: p.summary ?? null,
              description: p.description ?? null,
              locationText: p.locationText ?? null,
              projectSize: p.projectSize ?? null,
              completionDate: p.completionDate ? new Date(p.completionDate) : null,
              challenges: p.challenges ?? null,
              solutions: p.solutions ?? null,
              testimonial: p.testimonial ?? null,
              testimonialAuthor: p.testimonialAuthor ?? null,
              materials: toJson(p.materials ?? []),
              customFields: toJson(p.customFields ?? {}),
              featuredMediaId: mapOrNull(maps.media, p.featuredMediaId),
              videoMediaId: mapOrNull(maps.media, p.videoMediaId),
              status: enumOr(["DRAFT", "PUBLISHED", "ARCHIVED"] as const, p.status, "DRAFT"),
              isFeatured: p.isFeatured,
              sortOrder: p.sortOrder,
              seo: toJson(p.seo ?? {}),
            },
          });
          maps.project.set(p.id, row.id);
          const media = p.media.map((m) => ({ businessId, projectId: row.id, mediaId: maps.media.get(m.mediaId), stage: enumOr(["BEFORE", "PROGRESS", "AFTER", "VIDEO", "OTHER"] as const, m.stage, "AFTER"), caption: m.caption ?? null, sortOrder: m.sortOrder })).filter((m): m is typeof m & { mediaId: string } => !!m.mediaId);
          if (media.length) await tx.projectMedia.createMany({ data: media, skipDuplicates: true });
          const services = p.serviceIds.map((id) => maps.service.get(id)).filter((id): id is string => !!id);
          if (services.length) await tx.projectService.createMany({ data: services.map((serviceId) => ({ businessId, projectId: row.id, serviceId })), skipDuplicates: true });
        }
      }
      counts.projects = maps.project.size;

      // Reviews
      if (includeReviews && snapshot.reviews.length) {
        await tx.review.createMany({ data: snapshot.reviews.map((r) => ({ businessId, projectId: mapOrNull(maps.project, r.projectId), serviceId: mapOrNull(maps.service, r.serviceId), authorName: r.authorName, rating: r.rating, title: r.title ?? null, body: r.body, source: r.source ?? null, reviewedAt: r.reviewedAt ? new Date(r.reviewedAt) : null, isPublished: r.isPublished, isFeatured: r.isFeatured, sortOrder: r.sortOrder })) });
        counts.reviews = snapshot.reviews.length;
      } else counts.reviews = 0;

      // Pages + sections (parents first), then navigation (needs page ids)
      const pageSlugs = new Set<string>();
      for (const p of orderByParent(snapshot.pages)) {
        const row = await tx.page.create({
          data: {
            businessId,
            parentId: p.parentId ? maps.page.get(p.parentId) ?? null : null,
            slug: uniqueIn(pageSlugs, p.slug, true),
            title: p.title,
            kind: enumOr(["SYSTEM", "CUSTOM", "LANDING"] as const, p.kind, "CUSTOM"),
            systemKey: p.systemKey ?? null,
            templateKey: p.templateKey ?? "default",
            status: "DRAFT",
            audience: enumOr(["PUBLIC", "CUSTOMERS", "STAFF"] as const, p.audience, "PUBLIC"),
            showInNav: p.showInNav,
            sortOrder: p.sortOrder,
            seo: toJson(remapJson(p.seo ?? {}, maps)),
            settings: toJson(remapJson(p.settings ?? {}, maps)),
            createdByUserId: options.createdByUserId,
          },
        });
        maps.page.set(p.id, row.id);
        if (p.sections.length) {
          await tx.pageSection.createMany({ data: p.sections.map((s, i) => ({ businessId, pageId: row.id, type: s.type, sortOrder: s.sortOrder ?? i, props: toJson(remapJson(s.props ?? {}, maps)), settings: toJson(remapJson(s.settings ?? {}, maps)), isHidden: s.isHidden })) });
        }
      }
      counts.pages = maps.page.size;
      if (snapshot.navigation.length) {
        await tx.navigationMenu.createMany({ data: snapshot.navigation.map((n) => ({ businessId, key: n.key, name: n.name ?? n.key, draft: toJson(remapJson(n.draft ?? [], maps)) })), skipDuplicates: true });
      }

      // Redirects, settings rows
      if (snapshot.redirects.length) await tx.redirect.createMany({ data: snapshot.redirects.map((r) => ({ businessId, fromPath: r.fromPath, toPath: r.toPath, statusCode: r.statusCode, isActive: r.isActive })), skipDuplicates: true });
      for (const s of snapshot.settings) await tx.businessSetting.upsert({ where: { businessId_key: { businessId, key: s.key } }, create: { businessId, key: s.key, value: toJson(s.value) }, update: { value: toJson(s.value) } });

      // Business + theme: remapped media references and merged settings
      const currentSettings = asObject<Record<string, unknown>>(business.settings);
      const importedSettings = asObject<Record<string, unknown>>((snapshot.business.settings ?? null) as Prisma.JsonValue);
      await tx.business.update({
        where: { id: businessId },
        data: {
          logoMediaId: mapOrNull(maps.media, snapshot.business.logoMediaId),
          settings: toJson({ ...importedSettings, ...currentSettings, terminology: { ...(asObject(importedSettings.terminology as Prisma.JsonValue) ?? {}), ...(asObject(currentSettings.terminology as Prisma.JsonValue) ?? {}) } }),
          seoDefaults: toJson(remapJson(snapshot.seoDefaults ?? snapshot.business.seoDefaults ?? {}, maps)),
        },
      });
      if (themeOverrides) {
        const theme = await tx.businessTheme.findUnique({ where: { businessId } });
        if (theme) {
          const draft = asObject<ThemeTokens>(theme.draft);
          const patched = { ...draft, logoMediaId: mapOrNull(maps.media, rawTheme.logoMediaId), secondaryLogoMediaId: mapOrNull(maps.media, rawTheme.secondaryLogoMediaId), iconMediaId: mapOrNull(maps.media, rawTheme.iconMediaId), faviconMediaId: mapOrNull(maps.media, rawTheme.faviconMediaId) };
          await tx.businessTheme.update({ where: { businessId }, data: { draft: toJson(patched) } });
        }
      }
      counts.media = maps.media.size;
      return counts;
    },
    { timeout: 180_000 },
  );

  await recordAudit({ actorUserId: options.createdByUserId, organizationId: business.organizationId, businessId, action: options.auditAction ?? "business.imported", entityType: "business", entityId: businessId, severity: "NOTICE", metadata: { counts, warnings: warnings.slice(0, 20), templateId: options.templateId ?? null } });
  const fresh = await platformDb.business.findUniqueOrThrow({ where: { id: businessId } });
  return { business: fresh, warnings, counts };
}

/* ─────────────────────────────── helpers ────────────────────────────────── */

function mapOrNull(map: Map<string, string>, id: string | null | undefined): string | null {
  return id ? map.get(id) ?? null : null;
}

function mapList(map: Map<string, string>, value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => (typeof v === "string" ? map.get(v) : typeof v === "object" && v && "mediaId" in v ? map.get(String((v as { mediaId: unknown }).mediaId)) : undefined)).filter((v): v is string => !!v);
}

function uniqueIn(used: Set<string>, base: string, allowEmpty = false): string {
  let candidate = allowEmpty ? base : base || "item";
  let i = 2;
  const root = candidate;
  while (used.has(candidate)) candidate = `${root || "page"}-${i++}`;
  used.add(candidate);
  return candidate;
}

/** Orders rows so every parent appears before its children; orphans fall back to root. */
function orderByParent<T extends { id: string; parentId?: string | null }>(rows: T[]): T[] {
  const out: T[] = [];
  const placed = new Set<string>();
  let remaining = [...rows];
  while (remaining.length) {
    const next = remaining.filter((r) => !r.parentId || placed.has(r.parentId));
    if (next.length === 0) {
      // cycles / missing parents → treat as root
      out.push(...remaining.map((r) => ({ ...r, parentId: null })));
      break;
    }
    for (const r of next) {
      out.push(r);
      placed.add(r.id);
    }
    const ids = new Set(next.map((r) => r.id));
    remaining = remaining.filter((r) => !ids.has(r.id));
  }
  return out;
}

/** Every media id referenced by the snapshot content (used by callers that want to copy only what is used). */
export function collectReferencedMediaIds(snapshot: ParsedBusinessExport, opts: { includeProjects: boolean; includeTeam: boolean }): Set<string> {
  const ids = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "string" && UUID_LIKE.test(v)) ids.add(v);
  };
  const scan = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(scan);
    if (!value || typeof value !== "object") return;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (KEY_TO_MAP[k] === "media") add(v);
      else if (ARRAY_KEY_TO_MAP[k] === "media" && Array.isArray(v)) v.forEach(add);
      else scan(v);
    }
  };
  add(snapshot.business.logoMediaId);
  scan(snapshot.theme.draft);
  snapshot.services.forEach((s) => {
    add(s.featuredMediaId);
    add(s.videoMediaId);
    scan(s.gallery);
  });
  snapshot.materials.forEach((m) => add(m.mediaId));
  snapshot.pages.forEach((p) => p.sections.forEach((s) => {
    scan(s.props);
    scan(s.settings);
  }));
  if (opts.includeTeam) snapshot.teamMembers.forEach((t) => add(t.mediaId));
  if (opts.includeProjects) snapshot.projects.forEach((p) => {
    add(p.featuredMediaId);
    add(p.videoMediaId);
    p.media.forEach((m) => add(m.mediaId));
  });
  return ids;
}

export type { BusinessExportV1 };
