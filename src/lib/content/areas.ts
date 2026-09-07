import type { Prisma, ServiceArea, ServiceAreaType } from "@prisma/client";
import { z } from "zod";
import type { DbClient } from "@/lib/db";
import { asArray, asObject, toJson } from "@/lib/json";
import { slugify, uniqueSlug } from "@/lib/slug";

/**
 * Service-area (location engine) helpers for the business admin. All
 * functions take an RLS-scoped client plus the businessId and never trust
 * client-provided ids beyond looking them up inside the same business.
 *
 * ServiceArea.content = { intro, body (Markdown), highlights[], faqs[] }
 * ServiceArea.seo     = { title, description, noindex }
 * The public renderer (src/lib/site/areas.ts) marks areas without unique
 * content and without projects as noindex ("thin content").
 */

export const AREA_TYPES: Array<{ value: ServiceAreaType; label: string; plural: string }> = [
  { value: "COUNTRY", label: "Country", plural: "Countries" },
  { value: "STATE", label: "State", plural: "States" },
  { value: "REGION", label: "Region", plural: "Regions" },
  { value: "CITY", label: "City", plural: "Cities" },
  { value: "SUBURB", label: "Suburb", plural: "Suburbs" },
  { value: "POSTCODE", label: "Postcode", plural: "Postcodes" },
];
export const AREA_TYPE_VALUES = AREA_TYPES.map((t) => t.value) as [ServiceAreaType, ...ServiceAreaType[]];
export const AREA_TYPE_LABELS: Record<ServiceAreaType, string> = Object.fromEntries(AREA_TYPES.map((t) => [t.value, t.label])) as Record<ServiceAreaType, string>;
/** Rank used for the hierarchy (lower = broader). */
export const AREA_TYPE_RANK: Record<ServiceAreaType, number> = { COUNTRY: 0, STATE: 1, REGION: 2, CITY: 3, SUBURB: 4, POSTCODE: 5 };

export type AreaContent = { intro: string; body: string; highlights: string[]; faqs: Array<{ question: string; answer: string }> };
export type AreaSeo = { title?: string; description?: string; noindex?: boolean };

export function areaContent(area: Pick<ServiceArea, "content">): AreaContent {
  const raw = asObject<{ intro?: unknown; body?: unknown; highlights?: unknown; faqs?: unknown }>(area.content);
  return {
    intro: typeof raw.intro === "string" ? raw.intro.trim() : "",
    body: typeof raw.body === "string" ? raw.body.trim() : "",
    highlights: asArray<unknown>(raw.highlights as never).filter((h): h is string => typeof h === "string" && h.trim().length > 0),
    faqs: asArray<{ question?: unknown; answer?: unknown }>(raw.faqs as never)
      .map((f) => ({ question: typeof f?.question === "string" ? f.question : "", answer: typeof f?.answer === "string" ? f.answer : "" }))
      .filter((f) => f.question && f.answer),
  };
}

export function areaSeo(area: Pick<ServiceArea, "seo">): AreaSeo {
  const raw = asObject<AreaSeo>(area.seo);
  return { title: typeof raw.title === "string" ? raw.title : undefined, description: typeof raw.description === "string" ? raw.description : undefined, noindex: !!raw.noindex };
}

// ── Completeness ─────────────────────────────────────────────────────────────

export interface AreaCompleteness {
  /** 0 – 100 */
  score: number;
  /** true when the public renderer will mark the page noindex (no unique copy and no projects) */
  thin: boolean;
  checks: Array<{ key: string; label: string; done: boolean; weight: number }>;
}

/** Mirrors the renderer's thin-content rule and scores how much unique local content exists. */
export function areaCompleteness(content: AreaContent, seo: AreaSeo, counts: { services: number; projects: number }): AreaCompleteness {
  const checks = [
    { key: "intro", label: "Short intro written", done: content.intro.length >= 40, weight: 20 },
    { key: "body", label: "Body copy (150+ characters)", done: content.body.length >= 150, weight: 30 },
    { key: "highlights", label: "At least two local highlights", done: content.highlights.length >= 2, weight: 10 },
    { key: "faqs", label: "At least one local FAQ", done: content.faqs.length >= 1, weight: 10 },
    { key: "seo", label: "SEO title and description", done: !!seo.title && !!seo.description, weight: 10 },
    { key: "services", label: "Services offered here selected", done: counts.services > 0, weight: 10 },
    { key: "projects", label: "A project linked to this area", done: counts.projects > 0, weight: 10 },
  ];
  const score = checks.reduce((sum, c) => sum + (c.done ? c.weight : 0), 0);
  return { score, thin: !content.body && !content.intro && counts.projects === 0, checks };
}

// ── Listing ──────────────────────────────────────────────────────────────────

export interface AreaListFilter {
  type?: ServiceAreaType | null;
  enabled?: "all" | "enabled" | "disabled";
  q?: string;
  archived?: boolean;
}

export interface AreaListRow {
  id: string;
  parentId: string | null;
  type: ServiceAreaType;
  name: string;
  slug: string;
  postcode: string | null;
  state: string | null;
  country: string;
  isPrimary: boolean;
  isEnabled: boolean;
  generatePage: boolean;
  sortOrder: number;
  deletedAt: Date | null;
  updatedAt: Date;
  servicesCount: number;
  projectsCount: number;
  childrenCount: number;
  completeness: number;
  thin: boolean;
}

export interface AreaTreeNode extends AreaListRow {
  depth: number;
  children: AreaTreeNode[];
}

export async function listAreas(db: DbClient, businessId: string, filter: AreaListFilter = {}): Promise<AreaListRow[]> {
  const where: Prisma.ServiceAreaWhereInput = { businessId, deletedAt: filter.archived ? { not: null } : null };
  if (filter.type) where.type = filter.type;
  if (filter.enabled === "enabled") where.isEnabled = true;
  if (filter.enabled === "disabled") where.isEnabled = false;
  const q = filter.q?.trim();
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { postcode: { contains: q, mode: "insensitive" } }, { state: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }];
  const rows = await db.serviceArea.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { services: true, projects: true, children: true } } },
  });
  return rows.map((r) => {
    const c = areaCompleteness(areaContent(r), areaSeo(r), { services: r._count.services, projects: r._count.projects });
    return {
      id: r.id,
      parentId: r.parentId,
      type: r.type,
      name: r.name,
      slug: r.slug,
      postcode: r.postcode,
      state: r.state,
      country: r.country,
      isPrimary: r.isPrimary,
      isEnabled: r.isEnabled,
      generatePage: r.generatePage,
      sortOrder: r.sortOrder,
      deletedAt: r.deletedAt,
      updatedAt: r.updatedAt,
      servicesCount: r._count.services,
      projectsCount: r._count.projects,
      childrenCount: r._count.children,
      completeness: c.score,
      thin: c.thin,
    };
  });
}

/** Parent → children tree; rows whose parent is not in the set become roots. */
export function buildAreaTree(rows: AreaListRow[]): AreaTreeNode[] {
  const ids = new Set(rows.map((r) => r.id));
  const byParent = new Map<string | null, AreaListRow[]>();
  for (const r of rows) {
    const key = r.parentId && ids.has(r.parentId) ? r.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), r]);
  }
  const build = (parentId: string | null, depth: number, seen: Set<string>): AreaTreeNode[] =>
    (byParent.get(parentId) ?? [])
      .filter((r) => !seen.has(r.id))
      .map((r) => {
        seen.add(r.id);
        return { ...r, depth, children: build(r.id, depth + 1, seen) };
      });
  return build(null, 0, new Set());
}

export function countAreasByType(rows: AreaListRow[]): Record<ServiceAreaType, number> {
  const out = { COUNTRY: 0, STATE: 0, REGION: 0, CITY: 0, SUBURB: 0, POSTCODE: 0 } as Record<ServiceAreaType, number>;
  for (const r of rows) out[r.type] += 1;
  return out;
}

// ── Reading one ──────────────────────────────────────────────────────────────

export async function getArea(db: DbClient, businessId: string, id: string) {
  return db.serviceArea.findFirst({
    where: { id, businessId, deletedAt: undefined },
    include: {
      parent: { select: { id: true, name: true, type: true } },
      services: { select: { serviceId: true } },
      projects: { orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], select: { id: true, title: true, slug: true, status: true, completionDate: true, deletedAt: true } },
      _count: { select: { children: true } },
    },
  });
}

export type AreaDetail = NonNullable<Awaited<ReturnType<typeof getArea>>>;

export async function listAreaParentOptions(db: DbClient, businessId: string, excludeId?: string): Promise<Array<{ id: string; name: string; type: ServiceAreaType; parentId: string | null; depth: number }>> {
  const rows = await db.serviceArea.findMany({ where: { businessId, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, type: true, parentId: true } });
  const excluded = new Set<string>(excludeId ? [excludeId] : []);
  let grew = !!excludeId;
  while (grew) {
    grew = false;
    for (const r of rows) {
      if (r.parentId && excluded.has(r.parentId) && !excluded.has(r.id)) {
        excluded.add(r.id);
        grew = true;
      }
    }
  }
  const keep = rows.filter((r) => !excluded.has(r.id));
  const ids = new Set(keep.map((r) => r.id));
  const byParent = new Map<string | null, typeof keep>();
  for (const r of keep) {
    const key = r.parentId && ids.has(r.parentId) ? r.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), r]);
  }
  const out: Array<{ id: string; name: string; type: ServiceAreaType; parentId: string | null; depth: number }> = [];
  const walk = (parentId: string | null, depth: number, seen: Set<string>) => {
    for (const r of byParent.get(parentId) ?? []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({ ...r, depth });
      walk(r.id, depth + 1, seen);
    }
  };
  walk(null, 0, new Set());
  return out;
}

// ── Validation ───────────────────────────────────────────────────────────────

const optionalTrimmed = (max: number) => z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(max).optional().or(z.literal("")));
const boolish = z.preprocess((v) => v === true || v === "true" || v === "on" || v === "1", z.boolean());
const optionalNumber = (min: number, max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v === null ? undefined : v), z.coerce.number().min(min).max(max).optional());
const nullableId = z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null), z.string().uuid().nullable());
const idList = z.preprocess((v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x) : typeof v === "string" && v ? [v] : []), z.array(z.string().uuid()).max(1000));

export const AreaFaqSchema = z.object({ question: z.string().trim().min(1).max(300), answer: z.string().trim().min(1).max(5000) });
export const AreaContentSchema = z.object({
  intro: z.string().trim().max(600).optional(),
  body: z.string().trim().max(30_000).optional(),
  highlights: z.preprocess((v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()) : []), z.array(z.string().trim().max(200)).max(50)),
  faqs: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(AreaFaqSchema).max(50)),
});
export const AreaSeoSchema = z.object({ title: z.string().trim().max(160).optional(), description: z.string().trim().max(400).optional(), noindex: z.boolean().optional() });

export const AreaInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  slug: optionalTrimmed(120),
  type: z.enum(AREA_TYPE_VALUES),
  parentId: nullableId,
  postcode: optionalTrimmed(16),
  state: optionalTrimmed(60),
  country: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase().slice(0, 2) : "AU"), z.string().length(2, "Use a 2-letter country code")),
  lat: optionalNumber(-90, 90),
  lng: optionalNumber(-180, 180),
  radiusKm: optionalNumber(0, 5000),
  isPrimary: boolish,
  isEnabled: boolish,
  generatePage: boolish,
  content: z.preprocess((v) => (v && typeof v === "object" ? v : {}), AreaContentSchema),
  seo: z.preprocess((v) => (v && typeof v === "object" ? v : {}), AreaSeoSchema),
  serviceIds: idList,
});
export type AreaInput = z.infer<typeof AreaInputSchema>;

export class AreaNotFoundError extends Error {
  constructor() {
    super("Service area not found.");
    this.name = "AreaNotFoundError";
  }
}

async function ensureUniqueAreaSlug(db: DbClient, businessId: string, base: string, excludeId?: string): Promise<string> {
  return uniqueSlug(base, async (candidate) => {
    const hit = await db.serviceArea.findFirst({ where: { businessId, slug: candidate, deletedAt: undefined, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
    return !!hit;
  });
}

async function assertValidParent(db: DbClient, businessId: string, parentId: string | null, selfId?: string): Promise<void> {
  if (!parentId) return;
  if (selfId && parentId === selfId) throw new z.ZodError([{ code: "custom", path: ["parentId"], message: "An area cannot be its own parent." }]);
  const allowed = await listAreaParentOptions(db, businessId, selfId);
  if (!allowed.some((p) => p.id === parentId)) throw new z.ZodError([{ code: "custom", path: ["parentId"], message: "Choose a valid parent area." }]);
}

async function ownedServiceIds(db: DbClient, businessId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await db.service.findMany({ where: { businessId, id: { in: ids } }, select: { id: true } });
  return rows.map((r) => r.id);
}

function toAreaData(input: AreaInput, slug: string): Omit<Prisma.ServiceAreaUncheckedCreateInput, "businessId" | "sortOrder"> {
  const content: AreaContent = {
    intro: input.content.intro ?? "",
    body: input.content.body ?? "",
    highlights: input.content.highlights,
    faqs: input.content.faqs,
  };
  return {
    name: input.name,
    slug,
    type: input.type,
    parentId: input.parentId,
    postcode: input.postcode || null,
    state: input.state || null,
    country: input.country,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    radiusKm: input.radiusKm != null ? Math.round(input.radiusKm) : null,
    isPrimary: input.isPrimary,
    isEnabled: input.isEnabled,
    generatePage: input.generatePage,
    content: toJson(content),
    seo: toJson({ title: input.seo.title || undefined, description: input.seo.description || undefined, noindex: !!input.seo.noindex }),
  };
}

// ── Mutations ────────────────────────────────────────────────────────────────

async function nextSortOrder(db: DbClient, businessId: string, parentId: string | null): Promise<number> {
  const last = await db.serviceArea.findFirst({ where: { businessId, parentId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  return (last?.sortOrder ?? -1) + 1;
}

export async function createArea(db: DbClient, businessId: string, input: AreaInput): Promise<ServiceArea> {
  await assertValidParent(db, businessId, input.parentId);
  const slug = await ensureUniqueAreaSlug(db, businessId, input.slug || input.name);
  const area = await db.serviceArea.create({ data: { ...toAreaData(input, slug), businessId, sortOrder: await nextSortOrder(db, businessId, input.parentId) } });
  await setAreaServices(db, businessId, area.id, await ownedServiceIds(db, businessId, input.serviceIds));
  return area;
}

export async function updateArea(db: DbClient, businessId: string, id: string, input: AreaInput): Promise<{ before: ServiceArea; after: ServiceArea }> {
  const before = await db.serviceArea.findFirst({ where: { id, businessId, deletedAt: undefined } });
  if (!before) throw new AreaNotFoundError();
  await assertValidParent(db, businessId, input.parentId, id);
  const slug = await ensureUniqueAreaSlug(db, businessId, input.slug || input.name, id);
  const data = toAreaData(input, slug);
  const after = await db.serviceArea.update({ where: { id }, data: { ...data, ...(before.parentId !== input.parentId ? { sortOrder: await nextSortOrder(db, businessId, input.parentId) } : {}) } });
  await setAreaServices(db, businessId, id, await ownedServiceIds(db, businessId, input.serviceIds));
  return { before, after };
}

/** Replaces the set of services offered in an area. */
export async function setAreaServices(db: DbClient, businessId: string, areaId: string, serviceIds: string[]): Promise<void> {
  await db.serviceAreaService.deleteMany({ where: { businessId, serviceAreaId: areaId, serviceId: { notIn: serviceIds } } });
  const existing = new Set((await db.serviceAreaService.findMany({ where: { businessId, serviceAreaId: areaId }, select: { serviceId: true } })).map((r) => r.serviceId));
  const fresh = serviceIds.filter((s) => !existing.has(s));
  if (fresh.length) await db.serviceAreaService.createMany({ data: fresh.map((serviceId) => ({ businessId, serviceAreaId: areaId, serviceId })), skipDuplicates: true });
}

// ── Bulk add ─────────────────────────────────────────────────────────────────

export const BulkAddSchema = z.object({
  lines: z.string().min(1, "Paste at least one line."),
  type: z.enum(AREA_TYPE_VALUES),
  parentId: nullableId,
  country: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase().slice(0, 2) : "AU"), z.string().length(2)),
  isEnabled: boolish,
  generatePage: boolish,
  serviceIds: idList,
});
export type BulkAddInput = z.infer<typeof BulkAddSchema>;

export interface BulkAddLine {
  name: string;
  postcode: string | null;
  state: string | null;
}

/** Parses "Name[, postcode][, STATE]" lines. Postcode = 3–10 digits/letters; state = 2–3 uppercase letters. */
export function parseBulkLines(text: string): BulkAddLine[] {
  const out: BulkAddLine[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/[,\t;]/).map((p) => p.trim()).filter(Boolean);
    const name = parts.shift() ?? "";
    if (!name) continue;
    let postcode: string | null = null;
    let state: string | null = null;
    for (const p of parts) {
      if (!postcode && /^[0-9]{3,10}$/.test(p)) postcode = p;
      else if (!state && /^[A-Za-z]{2,3}$/.test(p)) state = p.toUpperCase();
      else if (!state && p.length <= 40) state = p;
    }
    out.push({ name: name.slice(0, 120), postcode, state });
  }
  return out;
}

export interface BulkAddResult {
  created: Array<{ id: string; name: string }>;
  skipped: Array<{ name: string; reason: string }>;
}

/** Creates one row per parsed line; lines whose slug already exists are skipped (never duplicated). */
export async function bulkAddAreas(db: DbClient, businessId: string, input: BulkAddInput): Promise<BulkAddResult> {
  await assertValidParent(db, businessId, input.parentId);
  const lines = parseBulkLines(input.lines);
  const serviceIds = await ownedServiceIds(db, businessId, input.serviceIds);
  const existing = new Set((await db.serviceArea.findMany({ where: { businessId, deletedAt: undefined }, select: { slug: true } })).map((r) => r.slug));
  const result: BulkAddResult = { created: [], skipped: [] };
  let sortOrder = await nextSortOrder(db, businessId, input.parentId);
  const seen = new Set<string>();
  for (const line of lines) {
    const slug = slugify(line.name) || "area";
    if (existing.has(slug) || seen.has(slug)) {
      result.skipped.push({ name: line.name, reason: existing.has(slug) ? "already exists" : "duplicate in the pasted list" });
      continue;
    }
    seen.add(slug);
    const area = await db.serviceArea.create({
      data: { businessId, name: line.name, slug, type: input.type, parentId: input.parentId, postcode: line.postcode, state: line.state, country: input.country, isEnabled: input.isEnabled, generatePage: input.generatePage, sortOrder: sortOrder++, content: {}, seo: {} },
    });
    if (serviceIds.length) await db.serviceAreaService.createMany({ data: serviceIds.map((serviceId) => ({ businessId, serviceAreaId: area.id, serviceId })), skipDuplicates: true });
    result.created.push({ id: area.id, name: area.name });
  }
  return result;
}

// ── Ordering, flags, archive ─────────────────────────────────────────────────

export const AreaReorderItemSchema = z.object({ id: z.string().uuid(), sortOrder: z.number().int().min(0).max(100_000) });
export type AreaReorderItem = z.infer<typeof AreaReorderItemSchema>;

/** Persists a new sortOrder among siblings (parents are unchanged). Ignores ids outside the business. */
export async function reorderAreas(db: DbClient, businessId: string, items: AreaReorderItem[]): Promise<number> {
  const rows = await db.serviceArea.findMany({ where: { businessId, id: { in: items.map((i) => i.id) } }, select: { id: true } });
  const owned = new Set(rows.map((r) => r.id));
  const valid = items.filter((it) => owned.has(it.id));
  for (const it of valid) await db.serviceArea.update({ where: { id: it.id }, data: { sortOrder: it.sortOrder } });
  return valid.length;
}

export type AreaFlag = "isEnabled" | "generatePage" | "isPrimary";

export async function setAreaFlag(db: DbClient, businessId: string, id: string, flag: AreaFlag, value: boolean): Promise<{ before: ServiceArea; after: ServiceArea }> {
  const before = await db.serviceArea.findFirst({ where: { id, businessId, deletedAt: undefined } });
  if (!before) throw new AreaNotFoundError();
  const after = await db.serviceArea.update({ where: { id }, data: { [flag]: value } });
  return { before, after };
}

export async function archiveArea(db: DbClient, businessId: string, id: string): Promise<ServiceArea> {
  const row = await db.serviceArea.findFirst({ where: { id, businessId } });
  if (!row) throw new AreaNotFoundError();
  // Children of an archived parent are re-attached to the grandparent so they stay visible.
  await db.serviceArea.updateMany({ where: { businessId, parentId: id }, data: { parentId: row.parentId } });
  return db.serviceArea.update({ where: { id }, data: { deletedAt: new Date(), isEnabled: false } });
}

export async function restoreArea(db: DbClient, businessId: string, id: string): Promise<ServiceArea> {
  const row = await db.serviceArea.findFirst({ where: { id, businessId, deletedAt: { not: null } } });
  if (!row) throw new AreaNotFoundError();
  return db.serviceArea.update({ where: { id }, data: { deletedAt: null } });
}

// ── Service matrix ───────────────────────────────────────────────────────────

export interface AreaMatrix {
  areas: Array<{ id: string; name: string; type: ServiceAreaType; depth: number; isEnabled: boolean }>;
  services: Array<{ id: string; name: string; depth: number }>;
  /** "areaId:serviceId" pairs currently linked */
  links: string[];
}

export async function loadAreaMatrix(db: DbClient, businessId: string): Promise<AreaMatrix> {
  const [areaRows, serviceRows, links] = await Promise.all([
    listAreas(db, businessId),
    db.service.findMany({ where: { businessId, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, parentId: true } }),
    db.serviceAreaService.findMany({ where: { businessId }, select: { serviceAreaId: true, serviceId: true } }),
  ]);
  const flat: AreaMatrix["areas"] = [];
  const walk = (nodes: AreaTreeNode[]) => {
    for (const n of nodes) {
      flat.push({ id: n.id, name: n.name, type: n.type, depth: n.depth, isEnabled: n.isEnabled });
      walk(n.children);
    }
  };
  walk(buildAreaTree(areaRows));
  const ids = new Set(serviceRows.map((s) => s.id));
  const byParent = new Map<string | null, typeof serviceRows>();
  for (const s of serviceRows) {
    const key = s.parentId && ids.has(s.parentId) ? s.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), s]);
  }
  const services: AreaMatrix["services"] = [];
  const walkServices = (parentId: string | null, depth: number, seen: Set<string>) => {
    for (const s of byParent.get(parentId) ?? []) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      services.push({ id: s.id, name: s.name, depth });
      walkServices(s.id, depth + 1, seen);
    }
  };
  walkServices(null, 0, new Set());
  return { areas: flat, services, links: links.map((l) => `${l.serviceAreaId}:${l.serviceId}`) };
}

export const MatrixCellSchema = z.object({ areaId: z.string().uuid(), serviceId: z.string().uuid(), on: z.boolean() });
export type MatrixCell = z.infer<typeof MatrixCellSchema>;

/** Applies a set of cell changes; ids outside the business are ignored. Returns how many were applied. */
export async function applyMatrixCells(db: DbClient, businessId: string, cells: MatrixCell[]): Promise<number> {
  const [areas, services] = await Promise.all([
    db.serviceArea.findMany({ where: { businessId, id: { in: [...new Set(cells.map((c) => c.areaId))] } }, select: { id: true } }),
    db.service.findMany({ where: { businessId, id: { in: [...new Set(cells.map((c) => c.serviceId))] } }, select: { id: true } }),
  ]);
  const areaIds = new Set(areas.map((a) => a.id));
  const serviceIds = new Set(services.map((s) => s.id));
  const valid = cells.filter((c) => areaIds.has(c.areaId) && serviceIds.has(c.serviceId));
  const on = valid.filter((c) => c.on);
  const off = valid.filter((c) => !c.on);
  if (on.length) await db.serviceAreaService.createMany({ data: on.map((c) => ({ businessId, serviceAreaId: c.areaId, serviceId: c.serviceId })), skipDuplicates: true });
  for (const c of off) await db.serviceAreaService.deleteMany({ where: { businessId, serviceAreaId: c.areaId, serviceId: c.serviceId } });
  return valid.length;
}

/** Services flattened for checkbox lists, ordered parent → children. */
export async function listServiceChoices(db: DbClient, businessId: string): Promise<Array<{ id: string; name: string; depth: number; isEnabled: boolean }>> {
  const rows = await db.service.findMany({ where: { businessId, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, parentId: true, isEnabled: true } });
  const ids = new Set(rows.map((r) => r.id));
  const byParent = new Map<string | null, typeof rows>();
  for (const r of rows) {
    const key = r.parentId && ids.has(r.parentId) ? r.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), r]);
  }
  const out: Array<{ id: string; name: string; depth: number; isEnabled: boolean }> = [];
  const walk = (parentId: string | null, depth: number, seen: Set<string>) => {
    for (const r of byParent.get(parentId) ?? []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({ id: r.id, name: r.name, depth, isEnabled: r.isEnabled });
      walk(r.id, depth + 1, seen);
    }
  };
  walk(null, 0, new Set());
  return out;
}
