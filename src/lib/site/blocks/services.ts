import type { PricingMethod, Service } from "@prisma/client";
import { tenantDb } from "@/lib/db";
import { pricingSummary, serviceFaqs, type ServiceFaq } from "@/lib/content/services";
import type { SiteContext } from "@/lib/tenant/resolve";
import { contentStatusFilter } from "./common";
import { resolveMediaMap, type ResolvedMedia } from "./media";

export interface SiteServiceCard {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  href: string;
  shortDescription: string | null;
  description: string | null;
  icon: string | null;
  pricingMethod: PricingMethod;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  priceUnit: string | null;
  /** Pre-formatted with the business currency; null when quote-only or no price. */
  priceLabel: string | null;
  pricingMethodLabel: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  isFeatured: boolean;
  image: ResolvedMedia | null;
  faqs: ServiceFaq[];
  children: SiteServiceCard[];
}

export type ServiceSource = "all" | "featured" | "selected";

function baseWhere(ctx: SiteContext) {
  return { businessId: ctx.business.id, isEnabled: true, ...contentStatusFilter(ctx) };
}

async function toCards(ctx: SiteContext, rows: Service[]): Promise<SiteServiceCard[]> {
  const images = await resolveMediaMap(ctx, rows.map((r) => r.featuredMediaId));
  const currency = ctx.business.currency;
  const locale = ctx.business.locale;
  return rows.map((r) => {
    const summary = pricingSummary(r, currency, locale);
    return {
      id: r.id,
      parentId: r.parentId,
      name: r.name,
      slug: r.slug,
      href: `/services/${r.slug}`,
      shortDescription: r.shortDescription,
      description: r.description,
      icon: r.icon,
      pricingMethod: r.pricingMethod,
      priceMinCents: r.priceMinCents,
      priceMaxCents: r.priceMaxCents,
      priceUnit: r.priceUnit,
      priceLabel: summary.range,
      pricingMethodLabel: summary.method,
      ctaLabel: r.ctaLabel,
      ctaHref: r.ctaHref,
      isFeatured: r.isFeatured,
      image: r.featuredMediaId ? (images.get(r.featuredMediaId) ?? null) : null,
      faqs: serviceFaqs(r),
      children: [],
    };
  });
}

/** Builds parent → children nesting; children whose parent is not in the set become roots. */
function nest(cards: SiteServiceCard[]): SiteServiceCard[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const roots: SiteServiceCard[] = [];
  for (const c of cards) {
    const parent = c.parentId ? byId.get(c.parentId) : undefined;
    if (parent && parent !== c) parent.children.push(c);
    else roots.push(c);
  }
  return roots;
}

/**
 * Services for a block. `all` and `featured` return the tree (parents with
 * nested children, limited by top-level count); `selected` keeps the order of
 * the given ids and does not nest.
 */
export async function loadServicesForBlock(ctx: SiteContext, opts: { source: ServiceSource; serviceIds?: string[]; limit?: number }): Promise<SiteServiceCard[]> {
  const db = tenantDb(ctx.business.id);
  const limit = Math.max(1, Math.min(200, opts.limit ?? 48));
  if (opts.source === "selected") {
    const ids = (opts.serviceIds ?? []).filter(Boolean);
    if (ids.length === 0) return [];
    const rows = await db.service.findMany({ where: { ...baseWhere(ctx), id: { in: ids } } });
    const cards = await toCards(ctx, rows);
    const order = new Map(ids.map((id, i) => [id, i]));
    return cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).slice(0, limit);
  }
  const rows = await db.service.findMany({ where: baseWhere(ctx), orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const cards = await toCards(ctx, rows);
  if (opts.source === "featured") {
    const featured = cards.filter((c) => c.isFeatured);
    // Featured children are shown as top-level cards; nest only featured-in-featured.
    return nest(featured).slice(0, limit);
  }
  return nest(cards).slice(0, limit);
}

/** Flat list (id, name, slug) for form service pickers and the calculator. */
export async function listServiceOptions(ctx: SiteContext): Promise<Array<{ id: string; name: string; slug: string; parentId: string | null }>> {
  const db = tenantDb(ctx.business.id);
  const rows = await db.service.findMany({ where: baseWhere(ctx), orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true, parentId: true } });
  return rows;
}

/** One service by id (published unless preview) — used by faq/pricing blocks. */
export async function loadServiceById(ctx: SiteContext, id: string | null | undefined): Promise<SiteServiceCard | null> {
  if (!id) return null;
  const db = tenantDb(ctx.business.id);
  const row = await db.service.findFirst({ where: { ...baseWhere(ctx), id } });
  if (!row) return null;
  const [card] = await toCards(ctx, [row]);
  return card ?? null;
}
