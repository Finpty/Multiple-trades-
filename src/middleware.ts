import { NextResponse, type NextRequest } from "next/server";
import { RESERVED_TOP_LEVEL, resolveRouteFromRequest } from "@/lib/tenant/routing";

/**
 * Tenant routing. No database access here (edge runtime): the middleware only
 * decides WHICH site a request belongs to and rewrites it to the internal
 * /_sites/<site>/<path> route, where the server resolves the business.
 *
 * Platform surfaces (/admin, /super-admin, /api, /login, ...) are only served
 * on platform hosts; on a tenant domain they 404 so a business site can never
 * expose the admin under its own domain.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const first = pathname.split("/")[1] ?? "";

  const route = resolveRouteFromRequest(host, pathname);

  // Platform host: reserved segments are platform surfaces, everything else is a tenant path.
  if (!route || route.mode === "path") {
    if (!route || RESERVED_TOP_LEVEL.has(first) || pathname === "/") {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = `/_sites/${route.site}${route.path === "/" ? "" : route.path}`;
    const res = NextResponse.rewrite(url);
    res.headers.set("x-tenant-mode", "path");
    res.headers.set("x-tenant-site", route.site);
    return res;
  }

  // Subdomain / custom domain: the whole host is one site.
  if (first === "_next" || first === "media" || first === "api" || pathname === "/favicon.ico" || pathname === "/robots.txt" || pathname === "/sitemap.xml") {
    // /api/site/* (form submissions, analytics) and media are shared infrastructure; everything else under /api is platform-only.
    if (first === "api" && !pathname.startsWith("/api/site/")) {
      return new NextResponse("Not found", { status: 404 });
    }
    const res = NextResponse.next();
    res.headers.set("x-tenant-mode", route.mode);
    res.headers.set("x-tenant-site", route.site);
    return res;
  }
  if (RESERVED_TOP_LEVEL.has(first)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const url = request.nextUrl.clone();
  url.pathname = `/_sites/${route.site}${route.path === "/" ? "" : route.path}`;
  url.search = search;
  const res = NextResponse.rewrite(url);
  res.headers.set("x-tenant-mode", route.mode);
  res.headers.set("x-tenant-site", route.site);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
