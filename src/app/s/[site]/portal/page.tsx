import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { applySiteRedirects, resolveSiteRequest, siteTerminology } from "@/lib/site/context";
import { loadPortal } from "@/lib/site/portal";
import { buildPageMetadata } from "@/lib/site/seo";
import { PortalDashboard } from "@/components/site/portal/portal-dashboard";

export const dynamic = "force-dynamic";

type Params = { site: string };
type Search = Record<string, string | string[] | undefined>;

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }): Promise<Metadata> {
  const { site } = await params;
  const { ctx } = await resolveSiteRequest(site, await searchParams);
  if (!ctx) return {};
  return buildPageMetadata({ ctx, path: "/portal", title: `${siteTerminology(ctx).customer} portal`, noindex: true });
}

/** Customer portal shell: sign-in prompt for visitors, read-only dashboard for linked customers. */
export default async function PortalPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { site } = await params;
  const search = await searchParams;
  const { ctx } = await resolveSiteRequest(site, search);
  if (!ctx) notFound();
  await applySiteRedirects(ctx, "/portal", search);
  const state = await loadPortal(ctx);
  return <PortalDashboard ctx={ctx} state={state} />;
}
