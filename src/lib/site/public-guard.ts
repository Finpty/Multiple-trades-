import { NextResponse, type NextRequest } from "next/server";
import type { Business } from "@prisma/client";
import { platformDb } from "@/lib/db";
import { enforceRateLimit, RateLimitError } from "@/lib/auth/rate-limit";
import { isUuid } from "@/lib/ids";

/** Shared guards for the public tenant-site API. */
export function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0]?.trim() : request.headers.get("x-real-ip")) || "0.0.0.0";
}

export async function loadPublishedBusiness(businessId: unknown): Promise<Business | null> {
  if (!isUuid(businessId)) return null;
  const business = await platformDb.business.findFirst({ where: { id: businessId, deletedAt: null } });
  if (!business || business.status !== "PUBLISHED") return null;
  return business;
}

export async function rateLimitOr429(scope: string, identifier: string, limit: number, windowSeconds: number): Promise<NextResponse | null> {
  try {
    await enforceRateLimit(scope, identifier, { limit, windowSeconds });
    return null;
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 429, headers: { "retry-after": String(error.retryAfterSeconds) } });
    }
    throw error;
  }
}

export async function isFeatureEnabled(businessId: string, key: string): Promise<boolean> {
  const row = await platformDb.businessFeature.findUnique({ where: { businessId_featureKey: { businessId, featureKey: key } } });
  return !!row?.isEnabled;
}

export function json<T>(body: T, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}
