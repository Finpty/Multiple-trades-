import type { Page } from "@prisma/client";
import type { TenantDb } from "@/lib/db";

export interface WebsiteOverview {
  counts: Record<"DRAFT" | "PUBLISHED" | "SCHEDULED" | "ARCHIVED", number>;
  total: number;
  /** Published pages whose draft changed after the last publish. */
  unpublishedDrafts: Array<Pick<Page, "id" | "title" | "slug" | "status" | "updatedAt" | "publishedAt">>;
  scheduled: Array<Pick<Page, "id" | "title" | "slug" | "scheduledAt">>;
  lastPagePublishedAt: Date | null;
  menus: Array<{ key: string; name: string; publishedAt: Date | null; hasUnpublishedChanges: boolean }>;
  redirects: number;
}

export function hasUnpublishedChanges(page: Pick<Page, "status" | "updatedAt" | "publishedAt" | "published">): boolean {
  if (page.status === "ARCHIVED") return false;
  if (!page.published || !page.publishedAt) return true;
  return page.updatedAt.getTime() > page.publishedAt.getTime() + 1500;
}

export async function loadWebsiteOverview(db: TenantDb, businessId: string): Promise<WebsiteOverview> {
  const [pages, menus, redirects] = await Promise.all([
    db.page.findMany({ where: { businessId }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }], select: { id: true, title: true, slug: true, status: true, updatedAt: true, publishedAt: true, scheduledAt: true, published: true } }),
    db.navigationMenu.findMany({ where: { businessId }, select: { key: true, name: true, draft: true, published: true, publishedAt: true } }),
    db.redirect.count({ where: { businessId, isActive: true } }),
  ]);
  const counts = { DRAFT: 0, PUBLISHED: 0, SCHEDULED: 0, ARCHIVED: 0 };
  for (const p of pages) counts[p.status]++;
  const unpublishedDrafts = pages.filter((p) => hasUnpublishedChanges(p)).map(({ id, title, slug, status, updatedAt, publishedAt }) => ({ id, title, slug, status, updatedAt, publishedAt }));
  const scheduled = pages.filter((p) => p.status === "SCHEDULED").map(({ id, title, slug, scheduledAt }) => ({ id, title, slug, scheduledAt }));
  const lastPagePublishedAt = pages.reduce<Date | null>((acc, p) => (p.publishedAt && (!acc || p.publishedAt > acc) ? p.publishedAt : acc), null);
  return {
    counts,
    total: pages.length,
    unpublishedDrafts,
    scheduled,
    lastPagePublishedAt,
    menus: menus.map((m) => ({ key: m.key, name: m.name, publishedAt: m.publishedAt, hasUnpublishedChanges: JSON.stringify(m.draft) !== JSON.stringify(m.published ?? []) })),
    redirects,
  };
}
