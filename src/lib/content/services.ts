import type { PricingMethod, Prisma, Service } from "@prisma/client";
import { z } from "zod";
import type { DbClient } from "@/lib/db";
import { asArray, asObject, toJson } from "@/lib/json";
import { formatCents } from "@/lib/money";
import { uniqueSlug } from "@/lib/slug";

/**
 * Service catalogue helpers for the business admin. Every function takes an
 * RLS-scoped client plus the businessId (belt and braces) and never trusts
 * client-provided ids beyond looking them up inside the same business.
 */

export type ServiceFaq = { question: string; answer: string };
export type ServiceSeo = { title?: string; description?: string; noindex?: boolean; socialImageId?: string | null };

export const PRICING_METHODS: Array<{ value: PricingMethod; label: string; hint: string }> = [
  { value: "QUOTE", label: "Quote only", hint: "No price is shown; visitors request a quote." },
  { value: "FIXED", label: "Fixed price", hint: "One price (uses the minimum price)." },
  { value: "RANGE", label: "Price range", hint: "Shown as “from – to”." },
  { value: "HOURLY", label: "Hourly rate", hint: "Price per hour." },
  { value: "DAY_RATE", label: "Day rate", hint: "Price per day." },
  { value: "PER_SQM", label: "Per square metre", hint: "Price per m²." },
  { value: "PER_UNIT", label: "Per unit", hint: "Price per unit (set the unit label)." },
  { value: "PER_LINEAR_METRE", label: "Per linear metre", hint: "Price per lineal metre." },
];

export const PRICING_METHOD_LABELS: Record<PricingMethod, string> = Object.fromEntries(PRICING_METHODS.map((m) => [m.value, m.label])) as Record<PricingMethod, string>;

const DEFAULT_UNITS: Partial<Record<PricingMethod, string>> = { HOURLY: "hour", DAY_RATE: "day", PER_SQM: "m²", PER_LINEAR_METRE: "lm" };

/** Human pricing summary, e.g. "Per m² · $85.00 – $160.00 / m²". */
export function pricingSummary(s: Pick<Service, "pricingMethod" | "priceMinCents" | "priceMaxCents" | "priceUnit">, currency = "AUD", locale = "en-AU"): { method: string; range: string | null } {
  const method = PRICING_METHOD_LABELS[s.pricingMethod] ?? s.pricingMethod;
  if (s.pricingMethod === "QUOTE") return { method, range: null };
  const unit = s.priceUnit || DEFAULT_UNITS[s.pricingMethod];
  const suffix = unit && s.pricingMethod !== "FIXED" && s.pricingMethod !== "RANGE" ? ` / ${unit}` : "";
  const min = s.priceMinCents != null ? formatCents(s.priceMinCents, currency, locale) : null;
  const max = s.priceMaxCents != null ? formatCents(s.priceMaxCents, currency, locale) : null;
  if (min && max && s.priceMaxCents !== s.priceMinCents) return { method, range: `${min} – ${max}${suffix}` };
  if (min) return { method, range: `${s.pricingMethod === "FIXED" ? "" : "From "}${min}${suffix}` };
  if (max) return { method, range: `Up to ${max}${suffix}` };
  return { method, range: null };
}

// ── Listing ──────────────────────────────────────────────────────────────────

export type ServiceListFilter = "active" | "enabled" | "disabled" | "archived";

export interface ServiceListRow {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  pricingMethod: PricingMethod;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  priceUnit: string | null;
  status: Service["status"];
  isEnabled: boolean;
  isFeatured: boolean;
  sortOrder: number;
  deletedAt: Date | null;
  updatedAt: Date;
  areasCount: number;
  childrenCount: number;
}

export interface ServiceTreeNode extends ServiceListRow {
  depth: number;
  children: ServiceTreeNode[];
}

export async function listServices(db: DbClient, businessId: string, filter: ServiceListFilter = "active"): Promise<ServiceListRow[]> {
  const where: Prisma.ServiceWhereInput = { businessId };
  if (filter === "archived") where.deletedAt = { not: null };
  else if (filter === "enabled") where.isEnabled = true;
  else if (filter === "disabled") where.isEnabled = false;
  const rows = await db.service.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { areas: true, children: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    parentId: r.parentId,
    name: r.name,
    slug: r.slug,
    pricingMethod: r.pricingMethod,
    priceMinCents: r.priceMinCents,
    priceMaxCents: r.priceMaxCents,
    priceUnit: r.priceUnit,
    status: r.status,
    isEnabled: r.isEnabled,
    isFeatured: r.isFeatured,
    sortOrder: r.sortOrder,
    deletedAt: r.deletedAt,
    updatedAt: r.updatedAt,
    areasCount: r._count.areas,
    childrenCount: r._count.children,
  }));
}

/** Builds a parent → children tree; rows whose parent is not in the set become roots. */
export function buildServiceTree(rows: ServiceListRow[]): ServiceTreeNode[] {
  const ids = new Set(rows.map((r) => r.id));
  const byParent = new Map<string | null, ServiceListRow[]>();
  for (const r of rows) {
    const key = r.parentId && ids.has(r.parentId) ? r.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), r]);
  }
  const build = (parentId: string | null, depth: number, seen: Set<string>): ServiceTreeNode[] =>
    (byParent.get(parentId) ?? [])
      .filter((r) => !seen.has(r.id))
      .map((r) => {
        seen.add(r.id);
        return { ...r, depth, children: build(r.id, depth + 1, seen) };
      });
  return build(null, 0, new Set());
}

/** Depth-first flattening of a tree (the order used by the sortable list). */
export function flattenServiceTree(tree: ServiceTreeNode[]): ServiceTreeNode[] {
  const out: ServiceTreeNode[] = [];
  const walk = (nodes: ServiceTreeNode[]) => {
    for (const n of nodes) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(tree);
  return out;
}

// ── Reading one ──────────────────────────────────────────────────────────────

export async function getService(db: DbClient, businessId: string, id: string) {
  return db.service.findFirst({
    where: { id, businessId, deletedAt: undefined },
    include: {
      areas: { select: { serviceAreaId: true } },
      materials: { select: { materialId: true } },
      projects: { include: { project: { select: { id: true, title: true, slug: true, status: true, deletedAt: true } } } },
      _count: { select: { children: true, leads: true, bookings: true } },
    },
  });
}

export type ServiceDetail = NonNullable<Awaited<ReturnType<typeof getService>>>;

export async function listParentOptions(db: DbClient, businessId: string, excludeId?: string): Promise<Array<{ id: string; name: string; parentId: string | null }>> {
  const rows = await db.service.findMany({ where: { businessId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, parentId: true } });
  if (!excludeId) return rows;
  // Exclude the service itself and all of its descendants (would create a cycle).
  const excluded = new Set<string>([excludeId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of rows) {
      if (r.parentId && excluded.has(r.parentId) && !excluded.has(r.id)) {
        excluded.add(r.id);
        grew = true;
      }
    }
  }
  return rows.filter((r) => !excluded.has(r.id));
}

// ── Validation ───────────────────────────────────────────────────────────────

const PRICING_METHOD_VALUES = PRICING_METHODS.map((m) => m.value) as [PricingMethod, ...PricingMethod[]];

const optionalTrimmed = (max: number) => z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(max).optional().or(z.literal("")));
const dollars = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.coerce.number().min(0).max(99_999_999).optional());
const boolish = z.preprocess((v) => v === true || v === "true" || v === "on" || v === "1", z.boolean());
const idList = z.preprocess((v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x) : typeof v === "string" && v ? [v] : []), z.array(z.string().uuid()).max(500));

export const ServiceFaqSchema = z.object({ question: z.string().trim().min(1).max(300), answer: z.string().trim().min(1).max(5000) });
export const ServiceSeoSchema = z.object({
  title: z.string().trim().max(160).optional(),
  description: z.string().trim().max(400).optional(),
  noindex: z.boolean().optional(),
  socialImageId: z.string().uuid().nullable().optional(),
});

export const ServiceInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(160),
  slug: optionalTrimmed(120),
  parentId: z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null), z.string().uuid().nullable()),
  shortDescription: optionalTrimmed(400),
  description: optionalTrimmed(20_000),
  icon: optionalTrimmed(80),
  isEnabled: boolish,
  isFeatured: boolish,
  status: z.enum(["DRAFT", "PUBLISHED"]),
  pricingMethod: z.enum(PRICING_METHOD_VALUES),
  priceMin: dollars,
  priceMax: dollars,
  priceUnit: optionalTrimmed(40),
  ctaLabel: optionalTrimmed(80),
  ctaHrefChoice: z.enum(["/quote", "/contact", "custom"]).default("/quote"),
  ctaHrefCustom: optionalTrimmed(500),
  featuredMediaId: z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null), z.string().uuid().nullable()),
  videoMediaId: z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null), z.string().uuid().nullable()),
  gallery: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(z.string().uuid()).max(100)),
  faqs: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(ServiceFaqSchema).max(100)),
  areaIds: idList,
  materialIds: idList,
  seo: z.preprocess((v) => (v && typeof v === "object" ? v : {}), ServiceSeoSchema),
});

export type ServiceInput = z.infer<typeof ServiceInputSchema>;

function resolveCtaHref(input: Pick<ServiceInput, "ctaHrefChoice" | "ctaHrefCustom">): string | null {
  if (input.ctaHrefChoice === "custom") {
    const href = (input.ctaHrefCustom ?? "").trim();
    if (!href) return null;
    if (!/^(\/|https?:\/\/|mailto:|tel:)/i.test(href)) throw new z.ZodError([{ code: "custom", path: ["ctaHrefCustom"], message: "Link must start with /, http://, https://, mailto: or tel:" }]);
    return href;
  }
  return input.ctaHrefChoice;
}

async function ensureUniqueServiceSlug(db: DbClient, businessId: string, base: string, excludeId?: string): Promise<string> {
  return uniqueSlug(base, async (candidate) => {
    const hit = await db.service.findFirst({ where: { businessId, slug: candidate, deletedAt: undefined, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
    return !!hit;
  });
}

async function assertValidParent(db: DbClient, businessId: string, parentId: string | null, selfId?: string): Promise<void> {
  if (!parentId) return;
  if (selfId && parentId === selfId) throw new z.ZodError([{ code: "custom", path: ["parentId"], message: "A service cannot be its own parent." }]);
  const allowed = await listParentOptions(db, businessId, selfId);
  if (!allowed.some((p) => p.id === parentId)) throw new z.ZodError([{ code: "custom", path: ["parentId"], message: "Choose a valid parent service." }]);
}

async function filterOwnedIds(db: DbClient, businessId: string, input: ServiceInput): Promise<{ areaIds: string[]; materialIds: string[]; mediaIds: Set<string> }> {
  const wantedMedia = [input.featuredMediaId, input.videoMediaId, input.seo.socialImageId, ...input.gallery].filter((x): x is string => !!x);
  const [areas, materials, media] = await Promise.all([
    input.areaIds.length ? db.serviceArea.findMany({ where: { businessId, id: { in: input.areaIds } }, select: { id: true } }) : [],
    input.materialIds.length ? db.material.findMany({ where: { businessId, id: { in: input.materialIds } }, select: { id: true } }) : [],
    wantedMedia.length ? db.media.findMany({ where: { businessId, id: { in: wantedMedia } }, select: { id: true } }) : [],
  ]);
  return { areaIds: areas.map((a) => a.id), materialIds: materials.map((m) => m.id), mediaIds: new Set(media.map((m) => m.id)) };
}

function toServiceData(input: ServiceInput, owned: { mediaIds: Set<string> }, slug: string): Omit<Prisma.ServiceUncheckedCreateInput, "businessId" | "sortOrder"> {
  const own = (id: string | null | undefined) => (id && owned.mediaIds.has(id) ? id : null);
  const min = input.priceMin != null ? Math.round(input.priceMin * 100) : null;
  let max = input.priceMax != null ? Math.round(input.priceMax * 100) : null;
  if (input.pricingMethod === "QUOTE") max = null;
  if (input.pricingMethod === "FIXED") max = null;
  if (min != null && max != null && max < min) throw new z.ZodError([{ code: "custom", path: ["priceMax"], message: "Maximum price must be greater than or equal to the minimum." }]);
  return {
    parentId: input.parentId,
    name: input.name,
    slug,
    shortDescription: input.shortDescription || null,
    description: input.description || null,
    icon: input.icon || null,
    pricingMethod: input.pricingMethod,
    priceMinCents: input.pricingMethod === "QUOTE" ? null : min,
    priceMaxCents: max,
    priceUnit: input.priceUnit || null,
    ctaLabel: input.ctaLabel || null,
    ctaHref: resolveCtaHref(input),
    faqs: toJson(input.faqs),
    seo: toJson({ ...input.seo, socialImageId: own(input.seo.socialImageId) }),
    featuredMediaId: own(input.featuredMediaId),
    videoMediaId: own(input.videoMediaId),
    gallery: toJson(input.gallery.filter((id) => owned.mediaIds.has(id))),
    status: input.status,
    isEnabled: input.isEnabled,
    isFeatured: input.isFeatured,
  };
}

// ── Mutations ────────────────────────────────────────────────────────────────

export async function createService(db: DbClient, businessId: string, input: ServiceInput): Promise<Service> {
  await assertValidParent(db, businessId, input.parentId);
  const owned = await filterOwnedIds(db, businessId, input);
  const slug = await ensureUniqueServiceSlug(db, businessId, input.slug || input.name);
  const last = await db.service.findFirst({ where: { businessId, parentId: input.parentId, deletedAt: undefined }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const service = await db.service.create({ data: { ...toServiceData(input, owned, slug), businessId, sortOrder: (last?.sortOrder ?? -1) + 1 } });
  await syncServiceLinks(db, businessId, service.id, owned);
  return service;
}

export async function updateService(db: DbClient, businessId: string, id: string, input: ServiceInput): Promise<{ before: Service; after: Service }> {
  const before = await db.service.findFirst({ where: { id, businessId } });
  if (!before) throw new ServiceNotFoundError();
  await assertValidParent(db, businessId, input.parentId, id);
  const owned = await filterOwnedIds(db, businessId, input);
  const slug = await ensureUniqueServiceSlug(db, businessId, input.slug || input.name, id);
  const after = await db.service.update({ where: { id }, data: toServiceData(input, owned, slug) });
  await syncServiceLinks(db, businessId, id, owned);
  return { before, after };
}

async function syncServiceLinks(db: DbClient, businessId: string, serviceId: string, owned: { areaIds: string[]; materialIds: string[] }): Promise<void> {
  await db.serviceAreaService.deleteMany({ where: { serviceId, businessId, serviceAreaId: { notIn: owned.areaIds } } });
  const existingAreas = new Set((await db.serviceAreaService.findMany({ where: { serviceId, businessId }, select: { serviceAreaId: true } })).map((a) => a.serviceAreaId));
  const newAreas = owned.areaIds.filter((a) => !existingAreas.has(a));
  if (newAreas.length) await db.serviceAreaService.createMany({ data: newAreas.map((serviceAreaId) => ({ businessId, serviceId, serviceAreaId })), skipDuplicates: true });

  await db.serviceMaterial.deleteMany({ where: { serviceId, materialId: { notIn: owned.materialIds } } });
  const existingMaterials = new Set((await db.serviceMaterial.findMany({ where: { serviceId }, select: { materialId: true } })).map((m) => m.materialId));
  const newMaterials = owned.materialIds.filter((m) => !existingMaterials.has(m));
  if (newMaterials.length) await db.serviceMaterial.createMany({ data: newMaterials.map((materialId) => ({ serviceId, materialId })), skipDuplicates: true });
}

export class ServiceNotFoundError extends Error {
  constructor() {
    super("Service not found.");
    this.name = "ServiceNotFoundError";
  }
}

export class ServiceInUseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceInUseError";
  }
}

export const ReorderItemSchema = z.object({ id: z.string().uuid(), parentId: z.string().uuid().nullable(), sortOrder: z.number().int().min(0).max(100_000) });
export type ReorderItem = z.infer<typeof ReorderItemSchema>;

/** Persists a new ordering (and parents) for the whole visible tree. Ignores ids that are not in this business. */
export async function reorderServices(db: DbClient, businessId: string, items: ReorderItem[]): Promise<number> {
  const rows = await db.service.findMany({ where: { businessId }, select: { id: true } });
  const owned = new Set(rows.map((r) => r.id));
  const valid = items.filter((it) => owned.has(it.id) && (it.parentId === null || (owned.has(it.parentId) && it.parentId !== it.id)));
  // Reject cycles: walk each item's parent chain within the submitted set.
  const parentOf = new Map(valid.map((v) => [v.id, v.parentId] as const));
  const safe = valid.filter((v) => {
    const seen = new Set<string>([v.id]);
    let p = v.parentId;
    while (p) {
      if (seen.has(p)) return false;
      seen.add(p);
      p = parentOf.get(p) ?? null;
    }
    return true;
  });
  for (const it of safe) await db.service.update({ where: { id: it.id }, data: { parentId: it.parentId, sortOrder: it.sortOrder } });
  return safe.length;
}

export async function setServiceFlag(db: DbClient, businessId: string, id: string, flag: "isEnabled" | "isFeatured", value: boolean): Promise<{ before: Service; after: Service }> {
  const before = await db.service.findFirst({ where: { id, businessId } });
  if (!before) throw new ServiceNotFoundError();
  const after = await db.service.update({ where: { id }, data: { [flag]: value } });
  return { before, after };
}

export async function archiveService(db: DbClient, businessId: string, id: string): Promise<Service> {
  const row = await db.service.findFirst({ where: { id, businessId } });
  if (!row) throw new ServiceNotFoundError();
  // Children of an archived parent are detached so they stay visible.
  await db.service.updateMany({ where: { businessId, parentId: id }, data: { parentId: row.parentId } });
  return db.service.update({ where: { id }, data: { deletedAt: new Date(), isEnabled: false } });
}

export async function restoreService(db: DbClient, businessId: string, id: string): Promise<Service> {
  const row = await db.service.findFirst({ where: { id, businessId, deletedAt: { not: null } } });
  if (!row) throw new ServiceNotFoundError();
  return db.service.update({ where: { id }, data: { deletedAt: null } });
}

/** Permanent delete: only allowed for archived services with no references from projects, leads, bookings, pricing or workflows. */
export async function deleteServicePermanently(db: DbClient, businessId: string, id: string): Promise<Service> {
  const row = await db.service.findFirst({
    where: { id, businessId, deletedAt: { not: null } },
    include: { _count: { select: { projects: true, leads: true, bookings: true, pricingItems: true, pricingRules: true, workflows: true, reviews: true, children: true } } },
  });
  if (!row) throw new ServiceNotFoundError();
  const refs: string[] = [];
  if (row._count.projects) refs.push(`${row._count.projects} project(s)`);
  if (row._count.leads) refs.push(`${row._count.leads} lead(s)`);
  if (row._count.bookings) refs.push(`${row._count.bookings} booking(s)`);
  if (row._count.pricingItems || row._count.pricingRules) refs.push("pricing items or rules");
  if (row._count.workflows) refs.push("a workflow");
  if (row._count.reviews) refs.push(`${row._count.reviews} review(s)`);
  if (row._count.children) refs.push(`${row._count.children} child service(s)`);
  if (refs.length) throw new ServiceInUseError(`This service is still referenced by ${refs.join(", ")}. Unlink those first or keep it archived.`);
  await db.service.delete({ where: { id } });
  return row;
}

// ── View helpers ─────────────────────────────────────────────────────────────

export function serviceFaqs(service: Pick<Service, "faqs">): ServiceFaq[] {
  return asArray<Partial<ServiceFaq>>(service.faqs).map((f) => ({ question: String(f?.question ?? ""), answer: String(f?.answer ?? "") }));
}

export function serviceSeo(service: Pick<Service, "seo">): ServiceSeo {
  return asObject<ServiceSeo>(service.seo);
}

export function serviceGallery(service: Pick<Service, "gallery">): string[] {
  return asArray<unknown>(service.gallery).filter((x): x is string => typeof x === "string");
}
