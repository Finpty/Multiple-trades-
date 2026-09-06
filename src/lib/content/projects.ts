import type { Prisma, Project, ProjectMediaStage } from "@prisma/client";
import { z } from "zod";
import type { DbClient } from "@/lib/db";
import { asArray, asObject, toJson } from "@/lib/json";
import { mediaUrls, type MediaUrlSet } from "@/lib/media/service";
import { uniqueSlug } from "@/lib/slug";

/**
 * Portfolio / project helpers for the business admin. Media is stored as
 * ProjectMedia rows (stage + caption + sortOrder); everything else lives on
 * the project row. Every function takes an RLS-scoped client plus the
 * businessId and only links to rows that belong to the same business.
 */

export type ProjectMaterialRow = { name: string; type: string; notes: string };
export type ProjectSeo = { title?: string; description?: string; noindex?: boolean; socialImageId?: string | null };

export const PROJECT_MEDIA_STAGES: Array<{ value: ProjectMediaStage; label: string; hint: string; kind: "IMAGE" | "VIDEO" }> = [
  { value: "BEFORE", label: "Before", hint: "How the site looked before work started.", kind: "IMAGE" },
  { value: "PROGRESS", label: "Progress", hint: "Work in progress — preparation, mid-install.", kind: "IMAGE" },
  { value: "AFTER", label: "After", hint: "The finished result. These are shown first on the website.", kind: "IMAGE" },
  { value: "VIDEO", label: "Video", hint: "Walkthroughs, time-lapses and clips.", kind: "VIDEO" },
];

export const PROJECT_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

/** Generic fallback for material type suggestions; industries can extend it via terminology.materialTypes (comma-separated). */
export const GENERIC_MATERIAL_TYPES = ["tile", "stone", "timber", "fixture", "fitting", "paint", "finish", "sealant", "adhesive", "grout", "pipe", "cable", "fabric", "glass", "metal", "other"];

export function materialTypeSuggestions(terminology: Record<string, unknown> | null | undefined): string[] {
  const raw = terminology?.materialTypes ?? terminology?.material_types;
  const fromIndustry = Array.isArray(raw) ? raw.map(String) : typeof raw === "string" ? raw.split(",") : [];
  const list = [...fromIndustry.map((s) => s.trim()).filter(Boolean), ...GENERIC_MATERIAL_TYPES];
  return [...new Set(list)];
}

// ── Listing ──────────────────────────────────────────────────────────────────

export type ProjectListFilter = "all" | "DRAFT" | "PUBLISHED" | "ARCHIVED" | "featured" | "deleted";

export interface ProjectListRow {
  id: string;
  title: string;
  slug: string;
  locationText: string | null;
  areaName: string | null;
  completionDate: Date | null;
  status: Project["status"];
  isFeatured: boolean;
  sortOrder: number;
  deletedAt: Date | null;
  updatedAt: Date;
  thumb: string | null;
  services: Array<{ id: string; name: string }>;
  mediaCount: number;
}

export async function listProjects(db: DbClient, businessId: string, opts: { filter?: ProjectListFilter; q?: string; serviceId?: string } = {}): Promise<ProjectListRow[]> {
  const filter = opts.filter ?? "all";
  const where: Prisma.ProjectWhereInput = { businessId };
  if (filter === "deleted") where.deletedAt = { not: null };
  else if (filter === "featured") where.isFeatured = true;
  else if (filter !== "all") where.status = filter;
  if (opts.q) where.OR = [{ title: { contains: opts.q, mode: "insensitive" } }, { summary: { contains: opts.q, mode: "insensitive" } }, { locationText: { contains: opts.q, mode: "insensitive" } }];
  if (opts.serviceId) where.services = { some: { serviceId: opts.serviceId } };
  const rows = await db.project.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    include: {
      serviceArea: { select: { name: true } },
      services: { include: { service: { select: { id: true, name: true, deletedAt: true } } } },
      media: { orderBy: [{ stage: "asc" }, { sortOrder: "asc" }], include: { media: true } },
    },
  });
  const featuredIds = rows.map((r) => r.featuredMediaId).filter((x): x is string => !!x);
  const featured = featuredIds.length ? await db.media.findMany({ where: { businessId, id: { in: featuredIds } } }) : [];
  const thumbs = new Map<string, string>();
  for (const m of featured) thumbs.set(m.id, (await mediaUrls(m)).thumb);
  const out: ProjectListRow[] = [];
  for (const r of rows) {
    let thumb = r.featuredMediaId ? thumbs.get(r.featuredMediaId) ?? null : null;
    if (!thumb) {
      const first = r.media.find((m) => m.stage === "AFTER" && m.media.kind === "IMAGE" && !m.media.deletedAt) ?? r.media.find((m) => m.media.kind === "IMAGE" && !m.media.deletedAt);
      if (first) thumb = (await mediaUrls(first.media)).thumb;
    }
    out.push({
      id: r.id,
      title: r.title,
      slug: r.slug,
      locationText: r.locationText,
      areaName: r.serviceArea?.name ?? null,
      completionDate: r.completionDate,
      status: r.status,
      isFeatured: r.isFeatured,
      sortOrder: r.sortOrder,
      deletedAt: r.deletedAt,
      updatedAt: r.updatedAt,
      thumb,
      services: r.services.filter((s) => !s.service.deletedAt).map((s) => ({ id: s.service.id, name: s.service.name })),
      mediaCount: r.media.length,
    });
  }
  return out;
}

// ── Reading one ──────────────────────────────────────────────────────────────

export async function getProject(db: DbClient, businessId: string, id: string) {
  return db.project.findFirst({
    where: { id, businessId, deletedAt: undefined },
    include: {
      services: { select: { serviceId: true } },
      media: { orderBy: [{ stage: "asc" }, { sortOrder: "asc" }], include: { media: true } },
      _count: { select: { reviews: true, jobs: true } },
    },
  });
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProject>>>;

export interface ProjectMediaView {
  id: string;
  mediaId: string;
  stage: ProjectMediaStage;
  caption: string;
  sortOrder: number;
  thumb: string;
  url: string;
  alt: string;
  kind: string;
  title: string | null;
}

export async function projectMediaViews(project: Pick<ProjectDetail, "media">): Promise<ProjectMediaView[]> {
  const out: ProjectMediaView[] = [];
  for (const pm of project.media) {
    if (pm.media.deletedAt) continue;
    const urls: MediaUrlSet = await mediaUrls(pm.media);
    out.push({ id: pm.id, mediaId: pm.mediaId, stage: pm.stage, caption: pm.caption ?? "", sortOrder: pm.sortOrder, thumb: urls.thumb, url: urls.url, alt: urls.alt, kind: pm.media.kind, title: pm.media.title });
  }
  return out;
}

/** Service areas + services for select/checkbox lists. */
export async function listProjectLinkOptions(db: DbClient, businessId: string) {
  const [areas, services] = await Promise.all([
    db.serviceArea.findMany({ where: { businessId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, type: true, parentId: true } }),
    db.service.findMany({ where: { businessId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, parentId: true } }),
  ]);
  return { areas, services };
}

// ── Validation ───────────────────────────────────────────────────────────────

const optionalTrimmed = (max: number) => z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(max).optional().or(z.literal("")));
const boolish = z.preprocess((v) => v === true || v === "true" || v === "on" || v === "1", z.boolean());
const idList = z.preprocess((v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x) : typeof v === "string" && v ? [v] : []), z.array(z.string().uuid()).max(500));
const nullableId = z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null), z.string().uuid().nullable());

export const ProjectMaterialSchema = z.object({ name: z.string().trim().min(1).max(160), type: z.string().trim().max(80).default(""), notes: z.string().trim().max(1000).default("") });
export const ProjectMediaItemSchema = z.object({
  mediaId: z.string().uuid(),
  stage: z.enum(["BEFORE", "PROGRESS", "AFTER", "VIDEO", "OTHER"]),
  caption: z.string().trim().max(300).default(""),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});
export const ProjectSeoSchema = z.object({
  title: z.string().trim().max(160).optional(),
  description: z.string().trim().max(400).optional(),
  noindex: z.boolean().optional(),
  socialImageId: z.string().uuid().nullable().optional(),
});

export const ProjectInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  slug: optionalTrimmed(120),
  summary: optionalTrimmed(600),
  description: optionalTrimmed(30_000),
  status: z.enum(PROJECT_STATUSES),
  isFeatured: boolish,
  sortOrder: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.coerce.number().int().min(0).max(100_000).optional()),
  locationText: optionalTrimmed(200),
  serviceAreaId: nullableId,
  serviceIds: idList,
  media: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(ProjectMediaItemSchema).max(400)),
  featuredMediaId: nullableId,
  videoMediaId: nullableId,
  materials: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(ProjectMaterialSchema).max(100)),
  projectSize: optionalTrimmed(120),
  completionDate: z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").nullable()),
  challenges: optionalTrimmed(10_000),
  solutions: optionalTrimmed(10_000),
  testimonial: optionalTrimmed(3000),
  testimonialAuthor: optionalTrimmed(120),
  seo: z.preprocess((v) => (v && typeof v === "object" ? v : {}), ProjectSeoSchema),
});

export type ProjectInput = z.infer<typeof ProjectInputSchema>;

export class ProjectNotFoundError extends Error {
  constructor() {
    super("Project not found.");
    this.name = "ProjectNotFoundError";
  }
}

async function ensureUniqueProjectSlug(db: DbClient, businessId: string, base: string, excludeId?: string): Promise<string> {
  return uniqueSlug(base, async (candidate) => {
    const hit = await db.project.findFirst({ where: { businessId, slug: candidate, deletedAt: undefined, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
    return !!hit;
  });
}

async function resolveOwned(db: DbClient, businessId: string, input: ProjectInput) {
  const wantedMedia = [input.featuredMediaId, input.videoMediaId, input.seo.socialImageId, ...input.media.map((m) => m.mediaId)].filter((x): x is string => !!x);
  const [services, media, area] = await Promise.all([
    input.serviceIds.length ? db.service.findMany({ where: { businessId, id: { in: input.serviceIds } }, select: { id: true } }) : [],
    wantedMedia.length ? db.media.findMany({ where: { businessId, id: { in: wantedMedia } }, select: { id: true } }) : [],
    input.serviceAreaId ? db.serviceArea.findFirst({ where: { businessId, id: input.serviceAreaId }, select: { id: true } }) : null,
  ]);
  return { serviceIds: services.map((s) => s.id), mediaIds: new Set(media.map((m) => m.id)), serviceAreaId: area?.id ?? null };
}

function toProjectData(input: ProjectInput, owned: { mediaIds: Set<string>; serviceAreaId: string | null }, slug: string): Omit<Prisma.ProjectUncheckedCreateInput, "businessId" | "sortOrder"> {
  const own = (id: string | null | undefined) => (id && owned.mediaIds.has(id) ? id : null);
  return {
    title: input.title,
    slug,
    summary: input.summary || null,
    description: input.description || null,
    status: input.status,
    isFeatured: input.isFeatured,
    locationText: input.locationText || null,
    serviceAreaId: owned.serviceAreaId,
    featuredMediaId: own(input.featuredMediaId),
    videoMediaId: own(input.videoMediaId),
    materials: toJson(input.materials),
    projectSize: input.projectSize || null,
    completionDate: input.completionDate ? new Date(`${input.completionDate}T00:00:00.000Z`) : null,
    challenges: input.challenges || null,
    solutions: input.solutions || null,
    testimonial: input.testimonial || null,
    testimonialAuthor: input.testimonialAuthor || null,
    seo: toJson({ ...input.seo, socialImageId: own(input.seo.socialImageId) }),
  };
}

export async function createProject(db: DbClient, businessId: string, input: ProjectInput): Promise<Project> {
  const owned = await resolveOwned(db, businessId, input);
  const slug = await ensureUniqueProjectSlug(db, businessId, input.slug || input.title);
  const last = await db.project.findFirst({ where: { businessId, deletedAt: undefined }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const project = await db.project.create({ data: { ...toProjectData(input, owned, slug), businessId, sortOrder: input.sortOrder ?? (last?.sortOrder ?? -1) + 1 } });
  await syncProjectLinks(db, businessId, project.id, input, owned);
  return project;
}

export async function updateProject(db: DbClient, businessId: string, id: string, input: ProjectInput): Promise<{ before: Project; after: Project }> {
  const before = await db.project.findFirst({ where: { id, businessId } });
  if (!before) throw new ProjectNotFoundError();
  const owned = await resolveOwned(db, businessId, input);
  const slug = await ensureUniqueProjectSlug(db, businessId, input.slug || input.title, id);
  const after = await db.project.update({ where: { id }, data: { ...toProjectData(input, owned, slug), ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}) } });
  await syncProjectLinks(db, businessId, id, input, owned);
  return { before, after };
}

async function syncProjectLinks(db: DbClient, businessId: string, projectId: string, input: ProjectInput, owned: { serviceIds: string[]; mediaIds: Set<string> }): Promise<void> {
  // Services
  await db.projectService.deleteMany({ where: { projectId, businessId, serviceId: { notIn: owned.serviceIds } } });
  const existing = new Set((await db.projectService.findMany({ where: { projectId, businessId }, select: { serviceId: true } })).map((s) => s.serviceId));
  const fresh = owned.serviceIds.filter((s) => !existing.has(s));
  if (fresh.length) await db.projectService.createMany({ data: fresh.map((serviceId) => ({ businessId, projectId, serviceId })), skipDuplicates: true });

  // Media: (mediaId, stage) is the natural key; re-number per stage in the order submitted.
  const wanted = new Map<string, { mediaId: string; stage: ProjectMediaStage; caption: string | null; sortOrder: number }>();
  const perStage = new Map<string, number>();
  for (const m of input.media) {
    if (!owned.mediaIds.has(m.mediaId)) continue;
    const key = `${m.mediaId}:${m.stage}`;
    if (wanted.has(key)) continue;
    const n = perStage.get(m.stage) ?? 0;
    perStage.set(m.stage, n + 1);
    wanted.set(key, { mediaId: m.mediaId, stage: m.stage, caption: m.caption || null, sortOrder: n });
  }
  const current = await db.projectMedia.findMany({ where: { projectId, businessId } });
  const toDelete = current.filter((c) => !wanted.has(`${c.mediaId}:${c.stage}`)).map((c) => c.id);
  if (toDelete.length) await db.projectMedia.deleteMany({ where: { id: { in: toDelete }, businessId } });
  for (const w of wanted.values()) {
    const hit = current.find((c) => c.mediaId === w.mediaId && c.stage === w.stage);
    if (hit) {
      if (hit.caption !== w.caption || hit.sortOrder !== w.sortOrder) await db.projectMedia.update({ where: { id: hit.id }, data: { caption: w.caption, sortOrder: w.sortOrder } });
    } else {
      await db.projectMedia.create({ data: { businessId, projectId, mediaId: w.mediaId, stage: w.stage, caption: w.caption, sortOrder: w.sortOrder } });
    }
  }
}

export async function setProjectFlag(db: DbClient, businessId: string, id: string, flag: "isFeatured", value: boolean): Promise<{ before: Project; after: Project }> {
  const before = await db.project.findFirst({ where: { id, businessId } });
  if (!before) throw new ProjectNotFoundError();
  const after = await db.project.update({ where: { id }, data: { [flag]: value } });
  return { before, after };
}

export async function setProjectStatus(db: DbClient, businessId: string, id: string, status: Project["status"]): Promise<{ before: Project; after: Project }> {
  const before = await db.project.findFirst({ where: { id, businessId } });
  if (!before) throw new ProjectNotFoundError();
  const after = await db.project.update({ where: { id }, data: { status } });
  return { before, after };
}

/** Soft delete (deletedAt). The row stays for jobs/reviews that reference it. */
export async function deleteProject(db: DbClient, businessId: string, id: string): Promise<Project> {
  const row = await db.project.findFirst({ where: { id, businessId } });
  if (!row) throw new ProjectNotFoundError();
  return db.project.update({ where: { id }, data: { deletedAt: new Date(), status: "ARCHIVED" } });
}

export async function restoreProject(db: DbClient, businessId: string, id: string): Promise<Project> {
  const row = await db.project.findFirst({ where: { id, businessId, deletedAt: { not: null } } });
  if (!row) throw new ProjectNotFoundError();
  return db.project.update({ where: { id }, data: { deletedAt: null, status: "DRAFT" } });
}

export const ProjectReorderSchema = z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int().min(0).max(100_000) })).max(2000);

export async function reorderProjects(db: DbClient, businessId: string, items: z.infer<typeof ProjectReorderSchema>): Promise<number> {
  const owned = new Set((await db.project.findMany({ where: { businessId }, select: { id: true } })).map((r) => r.id));
  const valid = items.filter((it) => owned.has(it.id));
  for (const it of valid) await db.project.update({ where: { id: it.id }, data: { sortOrder: it.sortOrder } });
  return valid.length;
}

/** Creates a Review row from the project's testimonial (or the provided text). */
export async function addTestimonialAsReview(db: DbClient, businessId: string, opts: { projectId: string | null; testimonial: string; author: string; rating?: number }) {
  const body = opts.testimonial.trim();
  if (!body) throw new z.ZodError([{ code: "custom", path: ["testimonial"], message: "Write the testimonial first." }]);
  const authorName = opts.author.trim() || "Customer";
  let projectId: string | null = null;
  let serviceId: string | null = null;
  if (opts.projectId) {
    const project = await db.project.findFirst({ where: { id: opts.projectId, businessId }, include: { services: { select: { serviceId: true } } } });
    if (!project) throw new ProjectNotFoundError();
    projectId = project.id;
    serviceId = project.services[0]?.serviceId ?? null;
    const dupe = await db.review.findFirst({ where: { businessId, projectId: project.id, body }, select: { id: true } });
    if (dupe) return { review: null, duplicate: true as const };
  }
  const last = await db.review.findFirst({ where: { businessId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const review = await db.review.create({
    data: { businessId, projectId, serviceId, authorName, rating: Math.min(5, Math.max(1, Math.round(opts.rating ?? 5))), body, source: "project", reviewedAt: new Date(), isPublished: true, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  return { review, duplicate: false as const };
}

// ── View helpers ─────────────────────────────────────────────────────────────

export function projectMaterials(project: Pick<Project, "materials">): ProjectMaterialRow[] {
  return asArray<Partial<ProjectMaterialRow>>(project.materials).map((m) => ({ name: String(m?.name ?? ""), type: String(m?.type ?? ""), notes: String(m?.notes ?? "") }));
}

export function projectSeo(project: Pick<Project, "seo">): ProjectSeo {
  return asObject<ProjectSeo>(project.seo);
}

export function toDateInput(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}
