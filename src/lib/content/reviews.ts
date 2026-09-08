import type { Prisma, Review } from "@prisma/client";
import { z } from "zod";
import type { DbClient } from "@/lib/db";

/** Customer reviews shown by the "reviews" block, service pages and project pages. */

export const REVIEW_SOURCES = ["manual", "google", "facebook", "hipages", "website", "email", "project", "other"] as const;

export interface ReviewRow {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  source: string | null;
  reviewedAt: Date | null;
  isPublished: boolean;
  isFeatured: boolean;
  sortOrder: number;
  deletedAt: Date | null;
  updatedAt: Date;
  projectTitle: string | null;
  serviceName: string | null;
}

export type ReviewFilter = "all" | "published" | "hidden" | "featured" | "archived";

export async function listReviews(db: DbClient, businessId: string, opts: { filter?: ReviewFilter; q?: string; rating?: number } = {}): Promise<ReviewRow[]> {
  const where: Prisma.ReviewWhereInput = { businessId };
  const filter = opts.filter ?? "all";
  if (filter === "archived") where.deletedAt = { not: null };
  else if (filter === "published") where.isPublished = true;
  else if (filter === "hidden") where.isPublished = false;
  else if (filter === "featured") where.isFeatured = true;
  if (opts.q) where.OR = [{ authorName: { contains: opts.q, mode: "insensitive" } }, { body: { contains: opts.q, mode: "insensitive" } }, { title: { contains: opts.q, mode: "insensitive" } }];
  if (opts.rating) where.rating = opts.rating;
  const rows = await db.review.findMany({ where, orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { reviewedAt: "desc" }, { createdAt: "desc" }], include: { project: { select: { title: true } }, service: { select: { name: true } } } });
  return rows.map((r) => ({ id: r.id, authorName: r.authorName, rating: r.rating, title: r.title, body: r.body, source: r.source, reviewedAt: r.reviewedAt, isPublished: r.isPublished, isFeatured: r.isFeatured, sortOrder: r.sortOrder, deletedAt: r.deletedAt, updatedAt: r.updatedAt, projectTitle: r.project?.title ?? null, serviceName: r.service?.name ?? null }));
}

export async function reviewStats(db: DbClient, businessId: string): Promise<{ count: number; average: number; byRating: Record<number, number> }> {
  const rows = await db.review.findMany({ where: { businessId, isPublished: true }, select: { rating: true } });
  const byRating: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of rows) { byRating[r.rating] = (byRating[r.rating] ?? 0) + 1; sum += r.rating; }
  return { count: rows.length, average: rows.length ? Math.round((sum / rows.length) * 10) / 10 : 0, byRating };
}

const optionalTrimmed = (max: number) => z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(max).optional().or(z.literal("")));
const nullableId = z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null), z.string().uuid().nullable());

export const ReviewInputSchema = z.object({
  authorName: z.string().trim().min(1, "Customer name is required").max(120),
  rating: z.coerce.number().int().min(1).max(5),
  title: optionalTrimmed(160),
  body: z.string().trim().min(1, "Write the review text").max(5000),
  source: optionalTrimmed(40),
  reviewedAt: z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").nullable()),
  projectId: nullableId,
  serviceId: nullableId,
  isPublished: z.preprocess((v) => v === true || v === "true" || v === "on" || v === "1", z.boolean()),
  isFeatured: z.preprocess((v) => v === true || v === "true" || v === "on" || v === "1", z.boolean()),
});
export type ReviewInput = z.infer<typeof ReviewInputSchema>;

export class ReviewNotFoundError extends Error {
  constructor() {
    super("Review not found.");
    this.name = "ReviewNotFoundError";
  }
}

async function ownedIds(db: DbClient, businessId: string, input: ReviewInput): Promise<{ projectId: string | null; serviceId: string | null }> {
  const [p, s] = await Promise.all([
    input.projectId ? db.project.findFirst({ where: { id: input.projectId, businessId }, select: { id: true } }) : null,
    input.serviceId ? db.service.findFirst({ where: { id: input.serviceId, businessId }, select: { id: true } }) : null,
  ]);
  return { projectId: p?.id ?? null, serviceId: s?.id ?? null };
}

function toData(input: ReviewInput, owned: { projectId: string | null; serviceId: string | null }) {
  return { authorName: input.authorName, rating: input.rating, title: input.title || null, body: input.body, source: input.source || null, reviewedAt: input.reviewedAt ? new Date(`${input.reviewedAt}T00:00:00Z`) : null, projectId: owned.projectId, serviceId: owned.serviceId, isPublished: input.isPublished, isFeatured: input.isFeatured };
}

export async function createReview(db: DbClient, businessId: string, input: ReviewInput): Promise<Review> {
  const [owned, last] = await Promise.all([ownedIds(db, businessId, input), db.review.findFirst({ where: { businessId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } })]);
  return db.review.create({ data: { businessId, ...toData(input, owned), sortOrder: (last?.sortOrder ?? -1) + 1 } });
}

export async function updateReview(db: DbClient, businessId: string, id: string, input: ReviewInput): Promise<{ before: Review; after: Review }> {
  const before = await db.review.findFirst({ where: { id, businessId } });
  if (!before) throw new ReviewNotFoundError();
  const owned = await ownedIds(db, businessId, input);
  const after = await db.review.update({ where: { id }, data: toData(input, owned) });
  return { before, after };
}

export async function setReviewFlag(db: DbClient, businessId: string, id: string, flag: "isPublished" | "isFeatured", value: boolean): Promise<Review> {
  const row = await db.review.findFirst({ where: { id, businessId } });
  if (!row) throw new ReviewNotFoundError();
  return db.review.update({ where: { id }, data: { [flag]: value } });
}

export async function archiveReview(db: DbClient, businessId: string, id: string): Promise<Review> {
  const row = await db.review.findFirst({ where: { id, businessId } });
  if (!row) throw new ReviewNotFoundError();
  return db.review.update({ where: { id }, data: { deletedAt: new Date(), isPublished: false } });
}

export async function restoreReview(db: DbClient, businessId: string, id: string): Promise<Review> {
  const row = await db.review.findFirst({ where: { id, businessId, deletedAt: { not: null } } });
  if (!row) throw new ReviewNotFoundError();
  return db.review.update({ where: { id }, data: { deletedAt: null } });
}

export const ReviewReorderSchema = z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int().min(0).max(100_000) })).max(2000);

export async function reorderReviews(db: DbClient, businessId: string, items: z.infer<typeof ReviewReorderSchema>): Promise<number> {
  let n = 0;
  for (const it of items) n += (await db.review.updateMany({ where: { id: it.id, businessId }, data: { sortOrder: it.sortOrder } })).count;
  return n;
}

export async function listReviewLinkOptions(db: DbClient, businessId: string) {
  const [projects, services] = await Promise.all([
    db.project.findMany({ where: { businessId }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }], select: { id: true, title: true } }),
    db.service.findMany({ where: { businessId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  return { projects, services };
}

export function toDateInput(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}
