import { tenantDb } from "@/lib/db";
import type { SiteContext } from "@/lib/tenant/resolve";
import { siteAbsoluteUrl } from "./context";
import { listAreaPages } from "./areas";
import { readSeoDefaults, readEntitySeo } from "./seo";

/**
 * sitemap.xml / robots.txt for one tenant site. Only published, public,
 * indexable content is listed; URLs are absolute and honour the primary
 * domain so the same code serves path mode and custom-domain mode.
 */
export interface SitemapEntry {
  url: string;
  lastmod: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
}

const iso = (d: Date | null | undefined) => (d ?? new Date()).toISOString();

export async function buildSitemapEntries(ctx: SiteContext): Promise<SitemapEntry[]> {
  const businessId = ctx.business.id;
  const db = tenantDb(businessId);
  const [pages, services, projects, areas] = await Promise.all([
    db.page.findMany({ where: { businessId, status: "PUBLISHED", audience: "PUBLIC" }, select: { slug: true, seo: true, publishedAt: true, updatedAt: true, systemKey: true } }),
    db.service.findMany({ where: { businessId, status: "PUBLISHED", isEnabled: true }, select: { slug: true, seo: true, updatedAt: true } }),
    db.project.findMany({ where: { businessId, status: "PUBLISHED" }, select: { slug: true, seo: true, updatedAt: true } }),
    listAreaPages(ctx, { indexableOnly: true }),
  ]);
  const entries: SitemapEntry[] = [];
  for (const p of pages) {
    if (readEntitySeo(p.seo).noindex || p.systemKey === "portal") continue;
    entries.push({ url: siteAbsoluteUrl(ctx, p.slug ? `/${p.slug}` : "/"), lastmod: iso(p.publishedAt ?? p.updatedAt), changefreq: p.slug ? "monthly" : "weekly", priority: p.slug ? 0.7 : 1 });
  }
  for (const s of services) {
    if (readEntitySeo(s.seo).noindex) continue;
    entries.push({ url: siteAbsoluteUrl(ctx, `/services/${s.slug}`), lastmod: iso(s.updatedAt), changefreq: "monthly", priority: 0.8 });
  }
  for (const p of projects) {
    if (readEntitySeo(p.seo).noindex) continue;
    entries.push({ url: siteAbsoluteUrl(ctx, `/projects/${p.slug}`), lastmod: iso(p.updatedAt), changefreq: "yearly", priority: 0.5 });
  }
  for (const a of areas) {
    entries.push({ url: siteAbsoluteUrl(ctx, `/areas/${a.slug}`), lastmod: iso(a.updatedAt), changefreq: "monthly", priority: 0.6 });
  }
  return entries;
}

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderSitemapXml(entries: SitemapEntry[]): string {
  const body = entries
    .map((e) => `  <url><loc>${escapeXml(e.url)}</loc><lastmod>${e.lastmod}</lastmod>${e.changefreq ? `<changefreq>${e.changefreq}</changefreq>` : ""}${e.priority !== undefined ? `<priority>${e.priority.toFixed(1)}</priority>` : ""}</url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function renderRobotsTxt(ctx: SiteContext): string {
  const noindex = !!readSeoDefaults(ctx).noindex || ctx.business.status !== "PUBLISHED";
  const sitemap = siteAbsoluteUrl(ctx, "/sitemap.xml");
  if (noindex) return `User-agent: *\nDisallow: /\n`;
  return `User-agent: *\nAllow: /\nDisallow: /portal\n\nSitemap: ${sitemap}\n`;
}
