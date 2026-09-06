import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { applySiteRedirects, resolveSiteRequest } from "@/lib/site/context";
import { loadProjectDetail, plainText } from "@/lib/site/detail";
import { buildPageMetadata, readEntitySeo } from "@/lib/site/seo";
import { ProjectPage } from "@/components/site/detail/project-page";

export const dynamic = "force-dynamic";

type Params = { site: string; slug: string };
type Search = Record<string, string | string[] | undefined>;

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }): Promise<Metadata> {
  const { site, slug } = await params;
  const { ctx } = await resolveSiteRequest(site, await searchParams);
  if (!ctx) return {};
  const detail = await loadProjectDetail(ctx, slug);
  if (!detail) return {};
  const seo = readEntitySeo(detail.project.seo);
  return buildPageMetadata({
    ctx,
    path: `/projects/${detail.project.slug}`,
    title: seo.title || detail.project.title,
    absoluteTitle: !!seo.title,
    description: seo.description || detail.project.summary || plainText(detail.project.description),
    noindex: seo.noindex || detail.project.status !== "PUBLISHED",
    canonical: seo.canonical,
    socialImageMediaId: seo.socialImageMediaId,
    socialImageUrl: seo.socialImageMediaId ? null : detail.featured?.large ?? null,
    type: "article",
  });
}

export default async function ProjectDetailPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { site, slug } = await params;
  const search = await searchParams;
  const { ctx } = await resolveSiteRequest(site, search);
  if (!ctx) notFound();
  await applySiteRedirects(ctx, `/projects/${slug}`, search);
  const detail = await loadProjectDetail(ctx, slug);
  if (!detail) notFound();
  return <ProjectPage ctx={ctx} detail={detail} />;
}
