import { resolveSiteRequest } from "@/lib/site/context";
import { renderRobotsTxt } from "@/lib/site/sitemap";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const { ctx } = await resolveSiteRequest(site, {});
  if (!ctx) return new Response("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain; charset=utf-8" }, status: 404 });
  return new Response(renderRobotsTxt(ctx), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=900" } });
}
