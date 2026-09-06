import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { applySiteRedirects, resolveSiteRequest } from "@/lib/site/context";
import { loadServiceDetail, plainText } from "@/lib/site/detail";
import { buildPageMetadata, readEntitySeo } from "@/lib/site/seo";
import { ServicePage } from "@/components/site/detail/service-page";

export const dynamic = "force-dynamic";

type Params = { site: string; slug: string };
type Search = Record<string, string | string[] | undefined>;

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }): Promise<Metadata> {
  const { site, slug } = await params;
  const { ctx } = await resolveSiteRequest(site, await searchParams);
  if (!ctx) return {};
  const detail = await loadServiceDetail(ctx, slug);
  if (!detail) return {};
  const seo = readEntitySeo(detail.service.seo);
  return buildPageMetadata({
    ctx,
    path: `/services/${detail.service.slug}`,
    title: seo.title || detail.service.name,
    absoluteTitle: !!seo.title,
    description: seo.description || detail.service.shortDescription || plainText(detail.service.description),
    noindex: seo.noindex || detail.service.status !== "PUBLISHED",
    canonical: seo.canonical,
    socialImageMediaId: seo.socialImageMediaId ?? detail.service.featuredMediaId,
  });
}

export default async function ServiceDetailPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { site, slug } = await params;
  const search = await searchParams;
  const { ctx } = await resolveSiteRequest(site, search);
  if (!ctx) notFound();
  await applySiteRedirects(ctx, `/services/${slug}`, search);
  const detail = await loadServiceDetail(ctx, slug);
  if (!detail) notFound();
  return <ServicePage ctx={ctx} detail={detail} />;
}
