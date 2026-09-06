import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { tenantDb } from "@/lib/db";
import { siteHref } from "@/lib/tenant/resolve";
import type { SiteContext } from "@/lib/tenant/resolve";
import { applySiteRedirects, resolveSiteRequest, siteTerminology, termPlural } from "@/lib/site/context";
import { loadAreaDetail } from "@/lib/site/areas";
import { plainText } from "@/lib/site/detail";
import { buildPageMetadata, readEntitySeo } from "@/lib/site/seo";
import { AreaPage } from "@/components/site/detail/area-page";

export const dynamic = "force-dynamic";

type Params = { site: string; slug: string };
type Search = Record<string, string | string[] | undefined>;

/** Path of the CMS "areas" system page (the canonical parent for thin area pages). */
async function areasIndexPath(ctx: SiteContext): Promise<string> {
  const page = await tenantDb(ctx.business.id).page.findFirst({ where: { businessId: ctx.business.id, systemKey: "areas", status: "PUBLISHED" }, select: { slug: true } });
  return page ? `/${page.slug}` : "/areas";
}

/** "<industry terminology> in <Area>": uses the industry name when the business has one. */
async function areaHeading(ctx: SiteContext, areaName: string): Promise<string> {
  const terms = siteTerminology(ctx);
  const services = termPlural(terms, "service");
  const industry = ctx.business.industryId ? await tenantDb(ctx.business.id).industry.findUnique({ where: { id: ctx.business.industryId }, select: { name: true } }) : null;
  if (industry?.name && !new RegExp(industry.name, "i").test(services)) return `${industry.name} ${services.toLowerCase()} in ${areaName}`;
  return `${services} in ${areaName}`;
}

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }): Promise<Metadata> {
  const { site, slug } = await params;
  const { ctx } = await resolveSiteRequest(site, await searchParams);
  if (!ctx) return {};
  const detail = await loadAreaDetail(ctx, slug);
  if (!detail || !detail.area.generatePage) return {};
  const seo = readEntitySeo(detail.area.seo);
  const heading = await areaHeading(ctx, detail.area.name);
  return buildPageMetadata({
    ctx,
    path: `/areas/${detail.area.slug}`,
    title: seo.title || heading,
    absoluteTitle: !!seo.title,
    description: seo.description || detail.content.intro || plainText(detail.content.body) || `${heading} by ${ctx.business.name}.`,
    // Thin pages (no unique content, no projects) must not compete with the areas index.
    noindex: seo.noindex || detail.thin,
    canonical: seo.canonical || (detail.thin ? await areasIndexPath(ctx) : null),
    socialImageMediaId: seo.socialImageMediaId,
  });
}

export default async function AreaDetailPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { site, slug } = await params;
  const search = await searchParams;
  const { ctx } = await resolveSiteRequest(site, search);
  if (!ctx) notFound();
  await applySiteRedirects(ctx, `/areas/${slug}`, search);
  const detail = await loadAreaDetail(ctx, slug);
  if (!detail) notFound();
  const areasPath = await areasIndexPath(ctx);
  if (!detail.area.generatePage) redirect(siteHref(ctx, areasPath));
  const heading = await areaHeading(ctx, detail.area.name);
  return <AreaPage ctx={ctx} detail={detail} heading={heading} areasPath={areasPath} />;
}
