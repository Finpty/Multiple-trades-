import { cache } from "react";
import type { Business, BusinessTheme, NavigationMenu } from "@prisma/client";
import { prisma, tenantDb } from "@/lib/db";

export type { TenantMode, ResolvedRoute } from "./routing";
export { resolveRouteFromRequest, RESERVED_TOP_LEVEL } from "./routing";
import type { TenantMode } from "./routing";

export interface SiteContext {
  business: Business;
  theme: BusinessTheme | null;
  menus: NavigationMenu[];
  mode: TenantMode;
  /** Prefix for internal links: "/kabura" in path mode, "" otherwise. */
  basePath: string;
  hostname: string;
  /** True when rendering draft content for an authorised editor. */
  preview: boolean;
  primaryDomain: string | null;
}

/**
 * Loads the tenant for a site request. Domain mode requires a VERIFIED domain
 * (any domain when not in production, so local testing with /etc/hosts works).
 */
export const loadSiteContext = cache(async (site: string, mode: TenantMode, opts: { preview?: boolean } = {}): Promise<SiteContext | null> => {
  let business: Business | null = null;
  if (mode === "domain") {
    const domain = await prisma.businessDomain.findUnique({ where: { hostname: site.toLowerCase() }, include: { business: true } });
    if (!domain) return null;
    if (domain.verificationStatus !== "VERIFIED" && process.env.NODE_ENV === "production") return null;
    business = domain.business;
  } else {
    business = await prisma.business.findUnique({ where: { slug: site.toLowerCase() } });
  }
  if (!business || business.deletedAt) return null;
  if (business.status === "ARCHIVED" || business.status === "SUSPENDED") return null;
  if (business.status !== "PUBLISHED" && !opts.preview) return null;

  const db = tenantDb(business.id);
  const [theme, menus, primary] = await Promise.all([
    db.businessTheme.findUnique({ where: { businessId: business.id } }),
    db.navigationMenu.findMany({ where: { businessId: business.id } }),
    db.businessDomain.findFirst({ where: { businessId: business.id, isPrimary: true, verificationStatus: "VERIFIED" } }),
  ]);
  return {
    business,
    theme,
    menus,
    mode,
    basePath: mode === "path" ? `/${business.slug}` : "",
    hostname: site,
    preview: !!opts.preview,
    primaryDomain: primary?.hostname ?? null,
  };
});

/** Build an in-site href that works in every tenant mode. */
export function siteHref(ctx: Pick<SiteContext, "basePath">, path: string): string {
  if (/^(https?:)?\/\//.test(path) || path.startsWith("mailto:") || path.startsWith("tel:") || path.startsWith("#")) return path;
  const clean = path.startsWith("/") ? path : `/${path}`;
  const joined = `${ctx.basePath}${clean === "/" ? "" : clean}`;
  return joined || "/";
}

/** Absolute public URL of a business (custom primary domain preferred). */
export function publicSiteUrl(business: Pick<Business, "slug">, primaryDomain: string | null): string {
  if (primaryDomain) return `https://${primaryDomain}`;
  const base = (process.env.PLATFORM_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/${business.slug}`;
}
