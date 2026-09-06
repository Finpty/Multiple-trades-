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
