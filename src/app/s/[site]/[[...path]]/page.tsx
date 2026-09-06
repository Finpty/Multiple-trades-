import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { applySiteRedirects, resolveSiteRequest } from "@/lib/site/context";
import { loadPageByPath } from "@/lib/site/pages";
import { buildPageMetadata, readEntitySeo } from "@/lib/site/seo";
import { SectionRenderer } from "@/components/site/section-renderer";
import { EditorBridge } from "@/components/site/editor-bridge";

export const dynamic = "force-dynamic";

type Params = { site: string; path?: string[] };
type Search = Record<string, string | string[] | undefined>;

const pathOf = (segments: string[]) => `/${segments.join("/")}`;

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }): Promise<Metadata> {
  const { site, path = [] } = await params;
  const { ctx } = await resolveSiteRequest(site, await searchParams);
  if (!ctx) return {};
  const page = await loadPageByPath(ctx, path);
  if (!page) return {};
  const seo = readEntitySeo(page.snapshot.seo);
  return buildPageMetadata({
    ctx,
    path: pathOf(path),
    title: seo.title || page.snapshot.title,
    absoluteTitle: !!seo.title,
    description: seo.description,
    noindex: seo.noindex || page.page.audience !== "PUBLIC" || page.page.systemKey === "portal",
    canonical: seo.canonical,
    socialImageMediaId: seo.socialImageMediaId,
  });
}

export default async function SitePage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { site, path = [] } = await params;
  const search = await searchParams;
  const { ctx, editor } = await resolveSiteRequest(site, search);
  if (!ctx) notFound();
  await applySiteRedirects(ctx, pathOf(path), search);
  const page = await loadPageByPath(ctx, path);
  if (!page) notFound();
  return (
    <>
      <SectionRenderer page={page} ctx={ctx} editor={editor} />
      {editor && <EditorBridge pageId={page.page.id} />}
    </>
  );
}
