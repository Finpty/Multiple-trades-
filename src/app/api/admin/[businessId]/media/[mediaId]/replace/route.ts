import { NextResponse, type NextRequest } from "next/server";
import { requireBusinessAccess, AuthorizationError } from "@/lib/authz";
import { assertSameOrigin, CsrfError } from "@/lib/auth/csrf";
import { recordAudit } from "@/lib/audit";
import { isUuid } from "@/lib/ids";
import { MediaError, replaceMediaFile } from "@/lib/media/service";
import { toMediaListItem } from "@/lib/media/library";

export const dynamic = "force-dynamic";

/** POST multipart/form-data { file } — replaces the bytes, keeps the id so every reference stays valid. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ businessId: string; mediaId: string }> }) {
  const { businessId, mediaId } = await params;
  if (!isUuid(businessId) || !isUuid(mediaId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    assertSameOrigin(request);
    const ctx = await requireBusinessAccess(businessId, "media.manage", { throwOnly: true });
    const existing = await ctx.db.media.findFirst({ where: { id: mediaId, businessId, deletedAt: null }, select: { id: true, originalName: true, mimeType: true, sizeBytes: true } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    const media = await replaceMediaFile(businessId, mediaId, Buffer.from(await file.arrayBuffer()), file.type || "application/octet-stream", file.name, ctx.user.id);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "media.replaced", entityType: "media", entityId: mediaId, before: { originalName: existing.originalName, mimeType: existing.mimeType, bytes: Number(existing.sizeBytes) }, after: { originalName: media.originalName, mimeType: media.mimeType, bytes: Number(media.sizeBytes) } });
    return NextResponse.json({ item: await toMediaListItem(media) });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof CsrfError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof MediaError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error("[media replace]", error);
    return NextResponse.json({ error: "Replace failed" }, { status: 500 });
  }
}
