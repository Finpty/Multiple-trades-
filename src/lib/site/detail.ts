import type { Material, Project, ProjectMedia, ProjectMediaStage, Review, Service, ServiceArea } from "@prisma/client";
import { tenantDb } from "@/lib/db";
import { asArray, asObject } from "@/lib/json";
import { formatCents } from "@/lib/money";
import { mediaUrls, type MediaUrlSet } from "@/lib/media/service";
import type { SiteContext } from "@/lib/tenant/resolve";
import { siteMediaMap } from "./context";

/**
 * Data loaders for the site detail pages (service / project) plus a small
 * dependency-free Markdown model used for owner-authored descriptions.
 * Everything is scoped with tenantDb + where businessId; drafts only load in
 * preview mode.
 */

// ── Markdown (minimal, safe) ─────────────────────────────────────────────────

export type InlineNode = { kind: "text"; text: string } | { kind: "strong" | "em" | "code"; children: InlineNode[] } | { kind: "link"; href: string; children: InlineNode[] };
export type MarkdownBlock =
  | { kind: "heading"; level: 2 | 3 | 4; children: InlineNode[] }
  | { kind: "paragraph"; children: InlineNode[] }
  | { kind: "list"; ordered: boolean; items: InlineNode[][] }
  | { kind: "quote"; children: InlineNode[] };

function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(h)) return h;
  return null;
}

export function parseInline(text: string): InlineNode[] {
  const out: InlineNode[] = [];
  const re = /(\*\*([^*]+)\*\*)|(__([^_]+)__)|(\*([^*\n]+)\*)|(_([^_\n]+)_)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    if (m[2] || m[4]) out.push({ kind: "strong", children: parseInline(m[2] ?? m[4]) });
    else if (m[6] || m[8]) out.push({ kind: "em", children: parseInline(m[6] ?? m[8]) });
    else if (m[10]) out.push({ kind: "code", children: [{ kind: "text", text: m[10] }] });
    else if (m[12]) {
      const href = safeHref(m[13]);
      if (href) out.push({ kind: "link", href, children: parseInline(m[12]) });
      else out.push({ kind: "text", text: m[12] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

/** Parses a Markdown subset (headings, paragraphs, lists, quotes, inline styles) into a render tree. */
export function parseMarkdown(source: string | null | undefined): MarkdownBlock[] {
  if (!source) return [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flushPara = () => {
    if (para.length) blocks.push({ kind: "paragraph", children: parseInline(para.join(" ")) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ kind: "list", ordered: list.ordered, items: list.items.map(parseInline) });
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const quote = /^>\s?(.*)$/.exec(line);
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    if (heading) {
      flushPara();
      flushList();
      const level = Math.min(4, Math.max(2, heading[1].length)) as 2 | 3 | 4;
      blocks.push({ kind: "heading", level, children: parseInline(heading[2]) });
      continue;
    }
    if (bullet || numbered) {
      flushPara();
      const ordered = !!numbered;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    if (quote) {
      flushPara();
      flushList();
      blocks.push({ kind: "quote", children: parseInline(quote[1]) });
      continue;
    }
    if (list) {
      // continuation of a list item
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return blocks;
}

export function plainText(source: string | null | undefined, max = 160): string {
  if (!source) return "";
  const text = source
    .replace(/[#>*_`]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

// ── Pricing display ──────────────────────────────────────────────────────────

const METHOD_LABELS: Record<Service["pricingMethod"], string> = {
  QUOTE: "Quote on request",
  FIXED: "Fixed price",
  RANGE: "Price range",
  HOURLY: "Hourly rate",
  DAY_RATE: "Day rate",
  PER_SQM: "Per square metre",
  PER_UNIT: "Per unit",
  PER_LINEAR_METRE: "Per linear metre",
};
const DEFAULT_UNITS: Partial<Record<Service["pricingMethod"], string>> = { HOURLY: "hour", DAY_RATE: "day", PER_SQM: "m²", PER_LINEAR_METRE: "lm", PER_UNIT: "unit" };

export interface PriceDisplay {
  method: string;
  /** e.g. "$85 – $160 / m²" or null when quote-only */
  range: string | null;
  unit: string | null;
  currency: string;
}

export function priceDisplay(s: Pick<Service, "pricingMethod" | "priceMinCents" | "priceMaxCents" | "priceUnit">, currency: string, locale: string): PriceDisplay {
  const method = METHOD_LABELS[s.pricingMethod] ?? s.pricingMethod;
  if (s.pricingMethod === "QUOTE") return { method, range: null, unit: null, currency };
  const unit = s.priceUnit || DEFAULT_UNITS[s.pricingMethod] || null;
  const suffix = unit && s.pricingMethod !== "FIXED" && s.pricingMethod !== "RANGE" ? ` / ${unit}` : "";
  const min = s.priceMinCents != null ? formatCents(s.priceMinCents, currency, locale) : null;
  const max = s.priceMaxCents != null ? formatCents(s.priceMaxCents, currency, locale) : null;
  let range: string | null = null;
  if (min && max && s.priceMaxCents !== s.priceMinCents) range = `${min} – ${max}${suffix}`;
  else if (min) range = `${s.pricingMethod === "FIXED" ? "" : "From "}${min}${suffix}`;
  else if (max) range = `Up to ${max}${suffix}`;
  return { method, range, unit, currency };
}

// ── Services ─────────────────────────────────────────────────────────────────

export type ServiceCard = Pick<Service, "id" | "name" | "slug" | "shortDescription" | "icon" | "pricingMethod" | "priceMinCents" | "priceMaxCents" | "priceUnit" | "featuredMediaId" | "parentId">;
export type ProjectCard = Pick<Project, "id" | "title" | "slug" | "summary" | "locationText" | "featuredMediaId" | "completionDate">;

export interface ServiceDetail {
  service: Service;
  parent: Pick<Service, "id" | "name" | "slug"> | null;
  children: ServiceCard[];
  projects: ProjectCard[];
  areas: Array<Pick<ServiceArea, "id" | "name" | "slug" | "type" | "generatePage">>;
  materials: Array<Pick<Material, "id" | "name" | "category" | "description" | "mediaId">>;
  reviews: Array<Pick<Review, "id" | "authorName" | "rating" | "title" | "body">>;
  faqs: Array<{ question: string; answer: string }>;
  media: Record<string, MediaUrlSet>;
  gallery: string[];
  price: PriceDisplay;
  quoteFormSlug: string | null;
}

function publishedFilter(ctx: SiteContext) {
  return ctx.preview ? { status: { not: "ARCHIVED" as const } } : { status: "PUBLISHED" as const };
}

export async function loadServiceDetail(ctx: SiteContext, slug: string): Promise<ServiceDetail | null> {
  const businessId = ctx.business.id;
  const db = tenantDb(businessId);
  const service = await db.service.findFirst({ where: { businessId, slug, isEnabled: true, ...publishedFilter(ctx) } });
  if (!service) return null;

  const [parent, children, projectLinks, areaLinks, materialLinks, reviews, quoteForm] = await Promise.all([
    service.parentId ? db.service.findFirst({ where: { businessId, id: service.parentId, isEnabled: true, ...publishedFilter(ctx) }, select: { id: true, name: true, slug: true } }) : Promise.resolve(null),
    db.service.findMany({ where: { businessId, parentId: service.id, isEnabled: true, ...publishedFilter(ctx) }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, slug: true, shortDescription: true, icon: true, pricingMethod: true, priceMinCents: true, priceMaxCents: true, priceUnit: true, featuredMediaId: true, parentId: true } }),
    db.projectService.findMany({ where: { businessId, serviceId: service.id }, include: { project: { select: { id: true, title: true, slug: true, summary: true, locationText: true, featuredMediaId: true, completionDate: true, status: true, sortOrder: true, deletedAt: true } } } }),
    db.serviceAreaService.findMany({ where: { businessId, serviceId: service.id }, include: { serviceArea: { select: { id: true, name: true, slug: true, type: true, generatePage: true, isEnabled: true, deletedAt: true, sortOrder: true } } } }),
    db.serviceMaterial.findMany({ where: { serviceId: service.id }, include: { material: { select: { id: true, name: true, category: true, description: true, mediaId: true, isActive: true, deletedAt: true, businessId: true, sortOrder: true } } } }),
    db.review.findMany({ where: { businessId, serviceId: service.id, isPublished: true }, orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }], take: 6, select: { id: true, authorName: true, rating: true, title: true, body: true } }),
    db.form.findFirst({ where: { businessId, action: "QUOTE_REQUEST", isActive: true }, orderBy: { createdAt: "asc" }, select: { slug: true } }),
  ]);

  const projects = projectLinks
    .map((l) => l.project)
    .filter((p) => !p.deletedAt && (ctx.preview ? p.status !== "ARCHIVED" : p.status === "PUBLISHED"))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 6);
  const areas = areaLinks
    .map((l) => l.serviceArea)
    .filter((a) => a.isEnabled && !a.deletedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const materials = materialLinks
    .map((l) => l.material)
    .filter((m) => m.businessId === businessId && m.isActive && !m.deletedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const gallery = asArray<unknown>(service.gallery).filter((x): x is string => typeof x === "string");
  const media = await siteMediaMap(ctx, [service.featuredMediaId, service.videoMediaId, ...gallery, ...children.map((c) => c.featuredMediaId), ...projects.map((p) => p.featuredMediaId), ...materials.map((m) => m.mediaId)]);
  const faqs = asArray<{ question?: unknown; answer?: unknown }>(service.faqs)
    .map((f) => ({ question: typeof f?.question === "string" ? f.question : "", answer: typeof f?.answer === "string" ? f.answer : "" }))
    .filter((f) => f.question);

  return {
    service,
    parent,
    children,
    projects,
    areas,
    materials,
    reviews,
    faqs,
    media,
    gallery,
    price: priceDisplay(service, ctx.business.currency, ctx.business.locale),
    quoteFormSlug: quoteForm?.slug ?? null,
  };
}

/** Top-level published services (navigation, footer, area fallbacks). */
export async function listTopLevelServices(ctx: SiteContext, limit = 12): Promise<ServiceCard[]> {
  const businessId = ctx.business.id;
  return tenantDb(businessId).service.findMany({
    where: { businessId, parentId: null, isEnabled: true, ...publishedFilter(ctx) },
    orderBy: { sortOrder: "asc" },
    take: limit,
    select: { id: true, name: true, slug: true, shortDescription: true, icon: true, pricingMethod: true, priceMinCents: true, priceMaxCents: true, priceUnit: true, featuredMediaId: true, parentId: true },
  });
}

// ── Projects ─────────────────────────────────────────────────────────────────

export interface ProjectMediaItem {
  id: string;
  stage: ProjectMediaStage;
  caption: string | null;
  media: MediaUrlSet;
}

export interface ProjectMaterialRow {
  name: string;
  type: string;
  notes: string;
}

export interface ProjectDetail {
  project: Project;
  area: Pick<ServiceArea, "id" | "name" | "slug" | "generatePage" | "isEnabled"> | null;
  services: Array<Pick<Service, "id" | "name" | "slug">>;
  byStage: Record<ProjectMediaStage, ProjectMediaItem[]>;
  featured: MediaUrlSet | null;
  video: MediaUrlSet | null;
  materials: ProjectMaterialRow[];
  related: ProjectCard[];
  relatedMedia: Record<string, MediaUrlSet>;
  prev: Pick<Project, "title" | "slug"> | null;
  next: Pick<Project, "title" | "slug"> | null;
  /** Before/after pair available for the comparison slider */
  pair: { before: MediaUrlSet; after: MediaUrlSet } | null;
}

export async function loadProjectDetail(ctx: SiteContext, slug: string): Promise<ProjectDetail | null> {
  const businessId = ctx.business.id;
  const db = tenantDb(businessId);
  const project = await db.project.findFirst({ where: { businessId, slug, ...publishedFilter(ctx) } });
  if (!project) return null;

  const [area, serviceLinks, projectMedia, all] = await Promise.all([
    project.serviceAreaId ? db.serviceArea.findFirst({ where: { businessId, id: project.serviceAreaId }, select: { id: true, name: true, slug: true, generatePage: true, isEnabled: true } }) : Promise.resolve(null),
    db.projectService.findMany({ where: { businessId, projectId: project.id }, include: { service: { select: { id: true, name: true, slug: true, isEnabled: true, status: true, deletedAt: true, sortOrder: true } } } }),
    db.projectMedia.findMany({ where: { businessId, projectId: project.id }, orderBy: [{ stage: "asc" }, { sortOrder: "asc" }], include: { media: true } }),
    db.project.findMany({ where: { businessId, ...publishedFilter(ctx) }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], select: { id: true, title: true, slug: true } }),
  ]);

  const services = serviceLinks
    .map((l) => l.service)
    .filter((s) => s.isEnabled && !s.deletedAt && (ctx.preview ? s.status !== "ARCHIVED" : s.status === "PUBLISHED"))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({ id: s.id, name: s.name, slug: s.slug }));

  const serviceIds = services.map((s) => s.id);
  const relatedLinks = serviceIds.length
    ? await db.projectService.findMany({ where: { businessId, serviceId: { in: serviceIds }, projectId: { not: project.id } }, include: { project: { select: { id: true, title: true, slug: true, summary: true, locationText: true, featuredMediaId: true, completionDate: true, status: true, deletedAt: true, sortOrder: true } } } })
    : [];
  const seen = new Set<string>();
  const related: ProjectCard[] = [];
  for (const link of relatedLinks.sort((a, b) => a.project.sortOrder - b.project.sortOrder)) {
    const p = link.project;
    if (seen.has(p.id) || p.deletedAt || (ctx.preview ? p.status === "ARCHIVED" : p.status !== "PUBLISHED")) continue;
    seen.add(p.id);
    related.push(p);
    if (related.length >= 3) break;
  }

  const media = await siteMediaMap(ctx, [project.featuredMediaId, project.videoMediaId, ...related.map((r) => r.featuredMediaId)]);
  const byStage: Record<ProjectMediaStage, ProjectMediaItem[]> = { BEFORE: [], PROGRESS: [], AFTER: [], VIDEO: [], OTHER: [] };
  for (const pm of projectMedia) {
    if (pm.media.deletedAt || pm.media.businessId !== businessId) continue;
    byStage[pm.stage].push({ id: pm.id, stage: pm.stage, caption: pm.caption, media: await mediaUrls(pm.media) });
  }
  const featured = media[project.featuredMediaId ?? ""] ?? byStage.AFTER[0]?.media ?? byStage.OTHER[0]?.media ?? null;
  const video = media[project.videoMediaId ?? ""] ?? byStage.VIDEO.find((v) => v.media.kind === "VIDEO")?.media ?? null;
  const beforeImage = byStage.BEFORE.find((m) => m.media.kind === "IMAGE")?.media;
  const afterImage = byStage.AFTER.find((m) => m.media.kind === "IMAGE")?.media;
  const pair = beforeImage && afterImage ? { before: beforeImage, after: afterImage } : null;

  const index = all.findIndex((p) => p.id === project.id);
  const prev = index > 0 ? all[index - 1] : null;
  const next = index >= 0 && index < all.length - 1 ? all[index + 1] : null;

  const materials = asArray<Record<string, unknown>>(project.materials)
    .map((m) => ({ name: typeof m?.name === "string" ? m.name : "", type: typeof m?.type === "string" ? m.type : "", notes: typeof m?.notes === "string" ? m.notes : "" }))
    .filter((m) => m.name || m.type);

  return { project, area, services, byStage, featured, video, materials, related, relatedMedia: media, prev, next, pair };
}

/** Grouped display helper for project media stages. */
export const PROJECT_STAGE_LABELS: Record<ProjectMediaStage, string> = { BEFORE: "Before", PROGRESS: "In progress", AFTER: "After", VIDEO: "Video", OTHER: "More photos" };

export function customFieldEntries(value: unknown): Array<{ key: string; value: string }> {
  return Object.entries(asObject<Record<string, unknown>>(value as never))
    .filter(([, v]) => v !== null && v !== undefined && v !== "" && typeof v !== "object")
    .map(([key, v]) => ({ key: key.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase()), value: String(v) }));
}
