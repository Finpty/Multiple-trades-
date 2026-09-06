import { NextResponse, type NextRequest } from "next/server";
import { tenantDb } from "@/lib/db";
import { normalizeFormFields } from "@/lib/site/blocks/forms";
import { validateSubmission } from "@/lib/forms/validate";
import { processFormSubmission } from "@/lib/forms/submit";
import type { SiteFormSubmitRequest, SiteFormSubmitResponse } from "@/lib/site/public-api";
import { clientIp, json, loadPublishedBusiness, rateLimitOr429 } from "@/lib/site/public-guard";
import { isUuid } from "@/lib/ids";

export const dynamic = "force-dynamic";

/**
 * POST /api/site/forms — public form submission (see src/lib/site/public-api.ts).
 * Accepts JSON, or multipart with a "payload" JSON field. Works from any
 * tenant hostname, so origin checks are replaced by honeypot + rate limits +
 * server-side validation against the form definition.
 */
export async function POST(request: NextRequest) {
  let body: SiteFormSubmitRequest | null = null;
  try {
    const type = request.headers.get("content-type") ?? "";
    if (type.includes("multipart/form-data")) {
      const fd = await request.formData();
      const payload = fd.get("payload");
      body = typeof payload === "string" ? (JSON.parse(payload) as SiteFormSubmitRequest) : null;
    } else body = (await request.json()) as SiteFormSubmitRequest;
  } catch {
    return json<SiteFormSubmitResponse>({ ok: false, message: "Invalid request." }, 400);
  }
  if (!body || typeof body !== "object" || typeof body.formSlug !== "string" || !body.data || typeof body.data !== "object") {
    return json<SiteFormSubmitResponse>({ ok: false, message: "Invalid request." }, 400);
  }
  // Honeypot: bots fill every field; humans never see it.
  if (typeof body.website === "string" && body.website.trim() !== "") return json<SiteFormSubmitResponse>({ ok: true, message: "Thanks." });

  const ip = clientIp(request);
  const limited = (await rateLimitOr429("site:forms:ip", ip, 20, 600)) ?? (await rateLimitOr429("site:forms:business", String(body.businessId), 200, 600));
  if (limited) return limited;

  const business = await loadPublishedBusiness(body.businessId);
  if (!business) return json<SiteFormSubmitResponse>({ ok: false, message: "This form is not available." }, 404);
  const db = tenantDb(business.id);
  const form = await db.form.findFirst({ where: { businessId: business.id, slug: body.formSlug, isActive: true } });
  if (!form) return json<SiteFormSubmitResponse>({ ok: false, message: "This form is not available." }, 404);

  const files = Array.isArray(body.files) ? body.files.filter((f) => f && typeof f.fieldKey === "string" && isUuid(f.mediaId)).slice(0, 20) : [];
  if (files.length) {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const owned = await db.media.findMany({ where: { businessId: business.id, id: { in: files.map((f) => f.mediaId) }, visibility: "PRIVATE", createdAt: { gte: since } }, select: { id: true } });
    const ok = new Set(owned.map((m) => m.id));
    if (files.some((f) => !ok.has(f.mediaId))) return json<SiteFormSubmitResponse>({ ok: false, message: "Uploaded files are no longer valid. Please re-attach them." }, 422);
  }

  const fields = normalizeFormFields(form.fields);
  const validated = validateSubmission(fields, body.data as Record<string, unknown>, files);
  if (!validated.ok) return json<SiteFormSubmitResponse>({ ok: false, message: "Please check the highlighted fields.", errors: validated.errors }, 422);

  try {
    const result = await processFormSubmission({
      business,
      form,
      fields,
      values: validated.values,
      files,
      meta: { ip, userAgent: request.headers.get("user-agent"), pageUrl: typeof body.pageUrl === "string" ? body.pageUrl : request.headers.get("referer") },
    });
    return json<SiteFormSubmitResponse>({ ok: true, message: result.message, redirectUrl: result.redirectUrl, submissionId: result.submissionId });
  } catch (error) {
    console.error("[site/forms]", error);
    return NextResponse.json({ ok: false, message: "We could not submit the form. Please try again or call us." } satisfies SiteFormSubmitResponse, { status: 500 });
  }
}
