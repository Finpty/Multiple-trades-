import type { Prisma } from "@prisma/client";
import { tenantDb } from "@/lib/db";
import type { SiteContext } from "@/lib/tenant/resolve";
import { contentStatusFilter, formatDate } from "./common";
import { resolveMediaMap, type ResolvedMedia } from "./media";

export interface SiteProjectCard {
  id: string;
  title: string;
  slug: string;
  href: string;
  summary: string | null;
  locationText: string | null;
  completionLabel: string | null;
  serviceNames: string[];
  /** AFTER image, else featured image. */
  image: ResolvedMedia | null;
  before: ResolvedMedia | null;
  afterImages: ResolvedMedia[];
  isFeatured: boolean;
}

export type ProjectSource = "all" | "featured" | "selected" | "by_service";

export async function loadProjectsForBlock(ctx: SiteContext, opts: { source: ProjectSource; projectIds?: string[]; serviceId?: string | null; limit?: number }): Promise<SiteProjectCard[]> {
  const db = tenantDb(ctx.business.id);
  const limit = Math.max(1, Math.min(200, opts.limit ?? 6));
  const where: Prisma.ProjectWhereInput = { businessId: ctx.business.id, ...contentStatusFilter(ctx) };
  if (opts.source === "featured") where.isFeatured = true;
  if (opts.source === "selected") {
    const ids = (opts.projectIds ?? []).filter(Boolean);
    if (ids.length === 0) return [];
    where.id = { in: ids };
  }
  if (opts.source === "by_service") {
    if (!opts.serviceId) return [];
    where.services = { some: { serviceId: opts.serviceId } };
  }
  const rows = await db.project.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { completionDate: "desc" }, { createdAt: "desc" }],
    take: opts.source === "selected" ? undefined : limit,
    include: {
      media: { orderBy: [{ sortOrder: "asc" }], select: { mediaId: true, stage: true } },
      services: { select: { service: { select: { name: true } } } },
    },
  });
  const ordered = opts.source === "selected" ? [...rows].sort((a, b) => (opts.projectIds!.indexOf(a.id)) - (opts.projectIds!.indexOf(b.id))).slice(0, limit) : rows;
  const mediaIds = ordered.flatMap((p) => [p.featuredMediaId, ...p.media.map((m) => m.mediaId)]);
  const media = await resolveMediaMap(ctx, mediaIds);
  return ordered.map((p) => {
    const after = p.media.filter((m) => m.stage === "AFTER").map((m) => media.get(m.mediaId)).filter((m): m is ResolvedMedia => !!m);
    const before = p.media.filter((m) => m.stage === "BEFORE").map((m) => media.get(m.mediaId)).find((m): m is ResolvedMedia => !!m) ?? null;
    const featured = p.featuredMediaId ? (media.get(p.featuredMediaId) ?? null) : null;
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      href: `/projects/${p.slug}`,
      summary: p.summary,
      locationText: p.locationText,
      completionLabel: p.completionDate ? formatDate(p.completionDate, ctx.business.locale) : null,
      serviceNames: p.services.map((s) => s.service.name),
      image: after[0] ?? featured,
      before,
      afterImages: after,
      isFeatured: p.isFeatured,
    };
  });
}

/** AFTER images across published projects (gallery source "projects"). */
export async function loadProjectAfterImages(ctx: SiteContext, limit = 24): Promise<Array<ResolvedMedia & { caption: string }>> {
  const projects = await loadProjectsForBlock(ctx, { source: "all", limit: 60 });
  const out: Array<ResolvedMedia & { caption: string }> = [];
  for (const p of projects) {
    const imgs = p.afterImages.length ? p.afterImages : p.image ? [p.image] : [];
    for (const img of imgs) {
      out.push({ ...img, caption: p.title });
      if (out.length >= limit) return out;
    }
  }
  return out;
}
