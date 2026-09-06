import { platformHosts } from "@/lib/env";

/**
 * Edge-safe tenant routing (no database, no Node APIs). Used by middleware.
 *
 * Platform host  + /kabura/...     → path mode
 * kabura.<platform host>/...       → subdomain mode
 * kaburatiling.com.au/...          → custom domain mode
 */
export type TenantMode = "path" | "subdomain" | "domain";

export interface ResolvedRoute {
  mode: TenantMode;
  /** Business slug (path/subdomain modes) or hostname (domain mode). */
  site: string;
  /** Remaining path inside the site, always starting with "/". */
  path: string;
}

function stripPort(host: string): string {
  return host.toLowerCase().replace(/:\d+$/, "");
}

export function resolveRouteFromRequest(hostHeader: string, pathname: string): ResolvedRoute | null {
  const host = stripPort(hostHeader);
  const hosts = platformHosts();
  if (hosts.includes(host)) {
    const [, first, ...rest] = pathname.split("/");
    if (!first) return null;
    return { mode: "path", site: first.toLowerCase(), path: "/" + rest.join("/") };
  }
  for (const platformHost of hosts) {
    if (host.endsWith("." + platformHost)) {
      const sub = host.slice(0, -(platformHost.length + 1));
      if (sub && sub !== "www" && !sub.includes(".")) return { mode: "subdomain", site: sub, path: pathname || "/" };
    }
  }
  return { mode: "domain", site: host, path: pathname || "/" };
}

/** First path segments that are platform surfaces on platform hosts and 404 on tenant hosts. */
export const RESERVED_TOP_LEVEL = new Set([
  "admin",
  "super-admin",
  "api",
  "login",
  "logout",
  "register",
  "auth",
  "media",
  "_next",
  "_sites",
  "favicon.ico",
  "robots.txt",
  "health",
  "portal",
]);
