import { NextResponse, type NextRequest } from "next/server";
import { RESERVED_TOP_LEVEL, resolveRouteFromRequest } from "@/lib/tenant/routing";

/**
 * Tenant routing. No database access here (edge runtime): the middleware only
 * decides WHICH site a request belongs to and rewrites it to the internal
 * /s/<site>/<path> route, where the server resolves the business.
 *
 * Platform surfaces (/admin, /super-admin, /api, /login, ...) are only served
 * on platform hosts; on a tenant domain they 404 so a business site can never
 * expose the admin under its own domain.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const first = pathname.split("/")[1] ?? "";

  // The internal site route is only reachable through a rewrite, never directly.
  if (first === "s") return new NextResponse("Not found", { status: 404 });

  const route = resolveRouteFromRequest(host, pathname);

  // Platform host: reserved segments are platform surfaces, everything else is a tenant path.
  if (!route || route.mode === "path") {
    if (!route || RESERVED_TOP_LEVEL.has(first) || pathname === "/") {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = `/s/${route.site}${route.path === "/" ? "" : route.path}`;
    return rewriteWithTenant(request, url, "path", route.site);
  }

  // Subdomain / custom domain: the whole host is one site.
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml") {
    const url = request.nextUrl.clone();
    url.pathname = `/s/${route.site}${pathname}`;
    return rewriteWithTenant(request, url, route.mode, route.site);
  }
  if (first === "_next" || first === "media" || first === "api" || pathname === "/favicon.ico") {
    // /api/site/* (form submissions, analytics) and media are shared infrastructure; everything else under /api is platform-only.
    if (first === "api" && !pathname.startsWith("/api/site/")) {
      return new NextResponse("Not found", { status: 404 });
    }
    return NextResponse.next({ request: { headers: tenantHeaders(request, route.mode, route.site) } });
  }
  if (RESERVED_TOP_LEVEL.has(first)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const url = request.nextUrl.clone();
  url.pathname = `/s/${route.site}${route.path === "/" ? "" : route.path}`;
  url.search = search;
  return rewriteWithTenant(request, url, route.mode, route.site);
}

/** Tenant context travels on the REQUEST headers so server components can read it with headers(). */
function tenantHeaders(request: NextRequest, mode: string, site: string): Headers {
  const h = new Headers(request.headers);
  h.set("x-tenant-mode", mode);
  h.set("x-tenant-site", site);
  return h;
}

function rewriteWithTenant(request: NextRequest, url: URL, mode: string, site: string) {
  const res = NextResponse.rewrite(url, { request: { headers: tenantHeaders(request, mode, site) } });
  res.headers.set("x-tenant-mode", mode);
  res.headers.set("x-tenant-site", site);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
