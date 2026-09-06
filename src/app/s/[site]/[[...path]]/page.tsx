import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveSiteRequest } from "@/lib/site/context";
import { loadPageByPath } from "@/lib/site/pages";
import { SectionRenderer } from "@/components/site/section-renderer";
import { EditorBridge } from "@/components/site/editor-bridge";

export const dynamic = "force-dynamic";

type Params = { site: string; path?: string[] };
type Search = Record<string, string | string[] | undefined>;

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }): Promise<Metadata> {
  const { site, path = [] } = await params;
  const { ctx } = await resolveSiteRequest(site, await searchParams);
  if (!ctx) return {};
  const page = await loadPageByPath(ctx, path);
  if (!page) return {};
  const seo = page.snapshot.seo as { title?: string; description?: string; noindex?: boolean };
  const defaults = ctx.business.seoDefaults as { titleSuffix?: string };
  return {
    title: { absolute: seo.title || `${page.snapshot.title}${defaults.titleSuffix ?? ` | ${ctx.business.name}`}` },
    description: seo.description || ctx.business.tagline || undefined,
    robots: seo.noindex || ctx.preview ? { index: false, follow: false } : undefined,
  };
}

export default async function SitePage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { site, path = [] } = await params;
  const { ctx, editor } = await resolveSiteRequest(site, await searchParams);
  if (!ctx) notFound();
  const page = await loadPageByPath(ctx, path);
  if (!page) notFound();
  return (
    <>
      <SectionRenderer page={page} ctx={ctx} editor={editor} />
      {editor && <EditorBridge pageId={page.page.id} />}
    </>
  );
}
