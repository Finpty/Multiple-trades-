import { platformHosts } from "@/lib/env";

/**
 * CSRF defence for route handlers that mutate state.
 *
 * Next.js Server Actions already enforce Origin/Host matching. Route handlers
 * do not, so any POST/PUT/PATCH/DELETE handler that relies on cookies must call
 * `assertSameOrigin(request)`. Tenant sites live on arbitrary custom domains,
 * so the rule is: the Origin (or Referer) host must equal the request Host,
 * or be one of the platform hosts.
 */
export function assertSameOrigin(request: Request): void {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!origin) throw new CsrfError("Missing Origin header");
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    throw new CsrfError("Invalid Origin header");
  }
  const requestHost = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").toLowerCase();
  if (originHost === requestHost) return;
  const bare = originHost.replace(/:\d+$/, "");
  if (platformHosts().includes(bare)) return;
  throw new CsrfError("Cross-origin request rejected");
}

export class CsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsrfError";
  }
}
