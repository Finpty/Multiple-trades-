import { resolveSiteRequest } from "@/lib/site/context";
import { buildSitemapEntries, renderSitemapXml } from "@/lib/site/sitemap";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const { ctx } = await resolveSiteRequest(site, {});
  if (!ctx) return new Response("Not found", { status: 404 });
  const entries = await buildSitemapEntries(ctx);
  return new Response(renderSitemapXml(entries), { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=900" } });
}
