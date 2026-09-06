import { NextResponse, type NextRequest } from "next/server";
import { platformDb } from "@/lib/db";
import type { SiteAnalyticsEvent } from "@/lib/site/public-api";
import { clientIp, isFeatureEnabled, rateLimitOr429 } from "@/lib/site/public-guard";
import { isUuid } from "@/lib/ids";
import { toJson } from "@/lib/json";

export const dynamic = "force-dynamic";

const TYPES = new Set(["page_view", "cta_click", "form_start", "form_submit", "quote_request", "phone_click", "estimate"]);

/** POST /api/site/analytics — lightweight first-party analytics beacon (feature "analytics"). */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limited = await rateLimitOr429("site:analytics:ip", ip, 600, 600);
  if (limited) return limited;
  let body: SiteAnalyticsEvent;
  try {
    body = (await request.json()) as SiteAnalyticsEvent;
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!isUuid(body?.businessId) || !TYPES.has(body.type) || typeof body.path !== "string") return new NextResponse(null, { status: 400 });
  const business = await platformDb.business.findFirst({ where: { id: body.businessId, deletedAt: null }, select: { id: true } });
  if (!business || !(await isFeatureEnabled(business.id, "analytics"))) return new NextResponse(null, { status: 204 });
  const ua = request.headers.get("user-agent") ?? "";
  let referrer: string | null = null;
  if (typeof body.referrer === "string" && body.referrer) {
    try {
      referrer = new URL(body.referrer).host.slice(0, 200);
    } catch {
      referrer = null;
    }
  }
  await platformDb.analyticsEvent.create({
    data: {
      businessId: business.id,
      type: body.type,
      path: body.path.slice(0, 500),
      referrer,
      sessionId: typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : null,
      country: request.headers.get("cf-ipcountry") ?? request.headers.get("x-vercel-ip-country") ?? null,
      device: /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop",
      metadata: toJson(body.metadata && typeof body.metadata === "object" ? body.metadata : {}),
    },
  }).catch(() => undefined);
  return new NextResponse(null, { status: 204 });
}
