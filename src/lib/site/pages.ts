import type { Page } from "@prisma/client";
import { tenantDb } from "@/lib/db";
import type { PublishedPageSnapshot } from "@/lib/blocks/schema";
import type { SiteContext } from "@/lib/tenant/resolve";

export interface RenderablePage {
  page: Page;
  snapshot: PublishedPageSnapshot;
  isDraft: boolean;
}

/**
 * Resolves a site path to a page. Published visitors get the immutable
 * snapshot; authorised preview requests get the live draft sections.
 */
export async function loadPageByPath(ctx: SiteContext, pathSegments: string[]): Promise<RenderablePage | null> {
  const slug = pathSegments.join("/");
  const db = tenantDb(ctx.business.id);
  const page = await db.page.findFirst({ where: { businessId: ctx.business.id, slug, status: ctx.preview ? { not: "ARCHIVED" } : "PUBLISHED" } });
  if (!page) return null;
  if (page.audience !== "PUBLIC" && !ctx.preview) return null;
  if (ctx.preview) {
    const sections = await db.pageSection.findMany({ where: { pageId: page.id }, orderBy: { sortOrder: "asc" } });
    return {
      page,
      isDraft: true,
      snapshot: {
        title: page.title,
        seo: page.seo as Record<string, unknown>,
        settings: page.settings as Record<string, unknown>,
        sections: sections.map((s) => ({ id: s.id, type: s.type, props: s.props as Record<string, unknown>, settings: s.settings as Record<string, unknown>, isHidden: s.isHidden })),
        version: 0,
        publishedAt: new Date().toISOString(),
      },
    };
  }
  if (!page.published) return null;
  return { page, isDraft: false, snapshot: page.published as unknown as PublishedPageSnapshot };
}

export async function loadSystemPage(ctx: SiteContext, systemKey: string): Promise<RenderablePage | null> {
  const db = tenantDb(ctx.business.id);
  const page = await db.page.findFirst({ where: { businessId: ctx.business.id, systemKey, status: ctx.preview ? { not: "ARCHIVED" } : "PUBLISHED" } });
  if (!page) return null;
  return loadPageByPath(ctx, page.slug ? page.slug.split("/") : []);
}

/**
 * Builds an in-memory page from block seeds so detail pages can reuse the
 * block registry (e.g. embed the quote form) without a database row.
 */
export function syntheticPage(ctx: SiteContext, key: string, title: string, sections: Array<{ type: string; props: Record<string, unknown>; settings?: Record<string, unknown> }>): RenderablePage {
  const now = new Date();
  const page: Page = {
    id: `synthetic-${key}`,
    businessId: ctx.business.id,
    parentId: null,
    slug: key,
    title,
    kind: "SYSTEM",
    systemKey: null,
    templateKey: "default",
    status: "PUBLISHED",
    audience: "PUBLIC",
    showInNav: false,
    sortOrder: 0,
    seo: {},
    settings: {},
    published: null,
    publishedAt: now,
    scheduledAt: null,
    archivedAt: null,
    createdByUserId: null,
    updatedByUserId: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  return {
    page,
    isDraft: ctx.preview,
    snapshot: {
      title,
      seo: {},
      settings: {},
      sections: sections.map((s, i) => ({ id: `${page.id}-${i}`, type: s.type, props: s.props, settings: s.settings ?? {}, isHidden: false })),
      version: 0,
      publishedAt: now.toISOString(),
    },
  };
}
