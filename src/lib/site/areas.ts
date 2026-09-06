import type { ServiceArea } from "@prisma/client";
import { tenantDb } from "@/lib/db";
import { asArray, asObject } from "@/lib/json";
import type { MediaUrlSet } from "@/lib/media/service";
import type { SiteContext } from "@/lib/tenant/resolve";
import { siteMediaMap } from "./context";
import { listTopLevelServices, type ProjectCard, type ServiceCard } from "./detail";

/**
 * Service-area pages. ServiceArea.content holds the unique local copy:
 *   { intro?: string, body?: string (Markdown), highlights?: string[], faqs?: [{question, answer}] }
 * A page with no unique content AND no projects is "thin": it still renders
 * but is marked noindex,follow with a canonical to the areas index.
 */
export interface AreaContent {
  intro: string;
  body: string;
  highlights: string[];
  faqs: Array<{ question: string; answer: string }>;
}

export function readAreaContent(area: Pick<ServiceArea, "content">): AreaContent {
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

export interface AreaDetail {
  area: ServiceArea;
  content: AreaContent;
  parent: Pick<ServiceArea, "id" | "name" | "slug" | "generatePage"> | null;
  services: ServiceCard[];
  /** true when no explicit ServiceAreaService rows exist and all services are shown */
  servicesFallback: boolean;
  projects: ProjectCard[];
  nearby: Array<Pick<ServiceArea, "id" | "name" | "slug" | "type">>;
  media: Record<string, MediaUrlSet>;
  /** No unique content and no projects → noindex */
  thin: boolean;
}

export function isAreaThin(content: AreaContent, projectCount: number): boolean {
  return !content.body && !content.intro && projectCount === 0;
}

export async function loadAreaDetail(ctx: SiteContext, slug: string): Promise<AreaDetail | null> {
  const businessId = ctx.business.id;
  const db = tenantDb(businessId);
  const area = await db.serviceArea.findFirst({ where: { businessId, slug, isEnabled: true } });
  if (!area) return null;
  const content = readAreaContent(area);

  const [parent, links, projects, siblings] = await Promise.all([
    area.parentId ? db.serviceArea.findFirst({ where: { businessId, id: area.parentId, isEnabled: true }, select: { id: true, name: true, slug: true, generatePage: true } }) : Promise.resolve(null),
    db.serviceAreaService.findMany({ where: { businessId, serviceAreaId: area.id }, include: { service: { select: { id: true, name: true, slug: true, shortDescription: true, icon: true, pricingMethod: true, priceMinCents: true, priceMaxCents: true, priceUnit: true, featuredMediaId: true, parentId: true, isEnabled: true, status: true, deletedAt: true, sortOrder: true } } } }),
    db.project.findMany({ where: { businessId, serviceAreaId: area.id, ...(ctx.preview ? { status: { not: "ARCHIVED" as const } } : { status: "PUBLISHED" as const }) }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], take: 6, select: { id: true, title: true, slug: true, summary: true, locationText: true, featuredMediaId: true, completionDate: true } }),
    db.serviceArea.findMany({ where: { businessId, isEnabled: true, generatePage: true, id: { not: area.id }, ...(area.parentId ? { parentId: area.parentId } : { parentId: null }) }, orderBy: { sortOrder: "asc" }, take: 12, select: { id: true, name: true, slug: true, type: true } }),
  ]);

  let services: ServiceCard[] = links
    .map((l) => l.service)
    .filter((s) => s.isEnabled && !s.deletedAt && (ctx.preview ? s.status !== "ARCHIVED" : s.status === "PUBLISHED"))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ isEnabled: _e, status: _s, deletedAt: _d, sortOrder: _o, ...card }) => card);
  const servicesFallback = services.length === 0;
  if (servicesFallback) services = await listTopLevelServices(ctx, 12);

  // Areas without siblings at their level fall back to any other area pages.
  let nearby = siblings;
  if (nearby.length === 0) nearby = await db.serviceArea.findMany({ where: { businessId, isEnabled: true, generatePage: true, id: { not: area.id } }, orderBy: { sortOrder: "asc" }, take: 12, select: { id: true, name: true, slug: true, type: true } });

  const media = await siteMediaMap(ctx, [...services.map((s) => s.featuredMediaId), ...projects.map((p) => p.featuredMediaId)]);
  return { area, content, parent, services, servicesFallback, projects, nearby, media, thin: isAreaThin(content, projects.length) };
}

/** Areas that get a public page. `indexable` excludes thin pages (for the sitemap). */
export async function listAreaPages(ctx: SiteContext, opts: { indexableOnly?: boolean } = {}): Promise<Array<Pick<ServiceArea, "id" | "name" | "slug" | "type" | "updatedAt" | "content">>> {
  const businessId = ctx.business.id;
  const db = tenantDb(businessId);
  const areas = await db.serviceArea.findMany({ where: { businessId, isEnabled: true, generatePage: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, slug: true, type: true, updatedAt: true, content: true } });
  if (!opts.indexableOnly) return areas;
  const counts = await db.project.groupBy({ by: ["serviceAreaId"], where: { businessId, status: "PUBLISHED", serviceAreaId: { in: areas.map((a) => a.id) } }, _count: { _all: true } });
  const projectsByArea = new Map(counts.map((c) => [c.serviceAreaId, c._count._all]));
  return areas.filter((a) => !isAreaThin(readAreaContent(a), projectsByArea.get(a.id) ?? 0));
}

/** Map embed URL (OpenStreetMap) from coordinates or a place name — no API key needed. */
export function areaMapEmbedUrl(area: Pick<ServiceArea, "name" | "lat" | "lng" | "state" | "country" | "postcode">): string {
  if (area.lat != null && area.lng != null) {
    const lat = Number(area.lat);
    const lng = Number(area.lng);
    const d = 0.05;
    const bbox = [lng - d, lat - d, lng + d, lat + d].map((n) => n.toFixed(5)).join(",");
    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat.toFixed(5)},${lng.toFixed(5)}`;
  }
  const query = [area.name, area.postcode, area.state, area.country].filter(Boolean).join(", ");
  return `https://www.openstreetmap.org/export/embed.html?layer=mapnik&query=${encodeURIComponent(query)}`;
}

export function areaMapLink(area: Pick<ServiceArea, "name" | "lat" | "lng" | "state" | "country">): string {
  if (area.lat != null && area.lng != null) return `https://www.openstreetmap.org/?mlat=${Number(area.lat)}&mlon=${Number(area.lng)}#map=13/${Number(area.lat)}/${Number(area.lng)}`;
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent([area.name, area.state, area.country].filter(Boolean).join(", "))}`;
}
