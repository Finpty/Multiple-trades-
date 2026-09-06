import { NextResponse, type NextRequest } from "next/server";
import { tenantDb } from "@/lib/db";
import { MediaError, uploadMedia } from "@/lib/media/service";
import { normalizeFormFields } from "@/lib/site/blocks/forms";
import { clientIp, json, loadPublishedBusiness, rateLimitOr429 } from "@/lib/site/public-guard";

export const dynamic = "force-dynamic";

/** POST /api/site/upload — multipart {businessId, formSlug, file} → PRIVATE media for a form submission. */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limited = await rateLimitOr429("site:upload:ip", ip, 30, 600);
  if (limited) return limited;
  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return json({ ok: false, error: "Invalid upload." }, 400);
  }
  const business = await loadPublishedBusiness(fd.get("businessId"));
  if (!business) return json({ ok: false, error: "Not available." }, 404);
  const formSlug = String(fd.get("formSlug") ?? "");
  const form = await tenantDb(business.id).form.findFirst({ where: { businessId: business.id, slug: formSlug, isActive: true } });
  if (!form) return json({ ok: false, error: "Not available." }, 404);
  const fields = normalizeFormFields(form.fields);
  if (!fields.some((f) => f.type === "file" || f.type === "photo" || f.type === "video")) return json({ ok: false, error: "This form does not accept files." }, 400);
  const file = fd.get("file");
  if (!(file instanceof File)) return json({ ok: false, error: "No file provided." }, 400);
  try {
    const media = await uploadMedia({
      businessId: business.id,
      buffer: Buffer.from(await file.arrayBuffer()),
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      visibility: "PRIVATE",
      folderKey: "submissions",
      tags: ["form-upload", formSlug],
    });
    return json({ ok: true, mediaId: media.id, name: media.originalName, size: Number(media.sizeBytes) }, 201);
  } catch (error) {
    if (error instanceof MediaError) return json({ ok: false, error: error.message }, 422);
    console.error("[site/upload]", error);
    return NextResponse.json({ ok: false, error: "Upload failed." }, { status: 500 });
  }
}
