import { NextResponse, type NextRequest } from "next/server";
import { platformDb } from "@/lib/db";
import { estimateForBusiness } from "@/lib/site/estimate";
import type { SiteEstimateRequest, SiteEstimateResponse } from "@/lib/site/public-api";
import { clientIp, isFeatureEnabled, json, loadPublishedBusiness, rateLimitOr429 } from "@/lib/site/public-guard";
import { isUuid } from "@/lib/ids";
import { toJson } from "@/lib/json";

export const dynamic = "force-dynamic";

/** POST /api/site/estimate — instant estimate via the business pricing engine (feature "calculator"). */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limited = await rateLimitOr429("site:estimate:ip", ip, 60, 600);
  if (limited) return limited;
  let body: SiteEstimateRequest;
  try {
    body = (await request.json()) as SiteEstimateRequest;
  } catch {
    return json<SiteEstimateResponse>({ ok: false, error: "Invalid request." }, 400);
  }
  const business = await loadPublishedBusiness(body?.businessId);
  if (!business || !(await isFeatureEnabled(business.id, "calculator"))) return json<SiteEstimateResponse>({ ok: false, error: "Estimates are not available." }, 404);
  const inputs = body.inputs && typeof body.inputs === "object" ? body.inputs : {};
  try {
    const result = await estimateForBusiness(business, isUuid(body.serviceId) ? body.serviceId : null, inputs);
    await platformDb.analyticsEvent.create({ data: { businessId: business.id, type: "estimate", path: null, metadata: toJson({ serviceId: body.serviceId ?? null, totalCents: result.totalCents }) } }).catch(() => undefined);
    return json(result);
  } catch (error) {
    console.error("[site/estimate]", error);
    return NextResponse.json({ ok: false, error: "Could not calculate an estimate." } satisfies SiteEstimateResponse, { status: 500 });
  }
}
