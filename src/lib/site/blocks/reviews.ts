import { tenantDb } from "@/lib/db";
import type { SiteContext } from "@/lib/tenant/resolve";
import { formatDate } from "./common";

export interface SiteReview {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  source: string | null;
  dateLabel: string | null;
  dateIso: string | null;
  serviceName: string | null;
  projectTitle: string | null;
}

export async function loadReviewsForBlock(ctx: SiteContext, opts: { source: "all" | "featured"; limit?: number }): Promise<{ reviews: SiteReview[]; average: number | null; count: number }> {
  const db = tenantDb(ctx.business.id);
  const limit = Math.max(1, Math.min(100, opts.limit ?? 6));
  const where = { businessId: ctx.business.id, ...(ctx.preview ? {} : { isPublished: true }), ...(opts.source === "featured" ? { isFeatured: true } : {}) };
  const [rows, agg] = await Promise.all([
    db.review.findMany({ where, orderBy: [{ sortOrder: "asc" }, { reviewedAt: "desc" }, { createdAt: "desc" }], take: limit, include: { service: { select: { name: true } }, project: { select: { title: true } } } }),
    db.review.aggregate({ where: { businessId: ctx.business.id, isPublished: true }, _avg: { rating: true }, _count: { _all: true } }),
  ]);
  return {
    reviews: rows.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      rating: Math.max(0, Math.min(5, r.rating)),
      title: r.title,
      body: r.body,
      source: r.source,
      dateLabel: r.reviewedAt ? formatDate(r.reviewedAt, ctx.business.locale) : null,
      dateIso: r.reviewedAt ? r.reviewedAt.toISOString().slice(0, 10) : null,
      serviceName: r.service?.name ?? null,
      projectTitle: r.project?.title ?? null,
    })),
    average: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
    count: agg._count._all,
  };
}
