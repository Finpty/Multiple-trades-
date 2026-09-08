import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { requireBusinessAccess, AuthorizationError } from "@/lib/authz";
import { assertSameOrigin, CsrfError } from "@/lib/auth/csrf";
import { recordAudit } from "@/lib/audit";
import { isUuid } from "@/lib/ids";
import { MediaError, deleteMedia } from "@/lib/media/service";
import { MediaLibraryError, MediaPatchSchema, findMediaUsage, getLibraryMedia, toMediaListItem, updateMediaMetadata } from "@/lib/media/library";
import { resolveMediaUrl } from "@/lib/storage";
import { platformDb } from "@/lib/db";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof CsrfError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof MediaError || error instanceof MediaLibraryError) return NextResponse.json({ error: error.message }, { status: 422 });
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 422 });
  console.error("[media]", error);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

type Params = { params: Promise<{ businessId: string; mediaId: string }> };

/** GET — full detail: item + file info + download URL + usage list. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { businessId, mediaId } = await params;
  if (!isUuid(businessId) || !isUuid(mediaId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    const ctx = await requireBusinessAccess(businessId, "media.manage", { throwOnly: true });
    const media = await getLibraryMedia(ctx.db, businessId, mediaId);
    if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const [item, usage, downloadUrl, uploader] = await Promise.all([
      toMediaListItem(media),
      findMediaUsage(ctx.db, businessId, mediaId),
      resolveMediaUrl({ storageDriver: media.storageDriver, storageKey: media.storageKey, visibility: "PRIVATE" }, 600),
      media.uploadedByUserId ? platformDb.user.findUnique({ where: { id: media.uploadedByUserId }, select: { name: true, email: true } }) : Promise.resolve(null),
    ]);
    return NextResponse.json({
      item,
      usage,
      downloadUrl,
      file: {
        storageDriver: media.storageDriver,
        storageKey: media.storageKey,
        checksum: media.checksum,
        durationSeconds: media.durationSeconds,
        variants: media.variants,
        uploadedBy: uploader ? uploader.name || uploader.email : null,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH — metadata: { title?, altText?, caption?, tags?, folderId?, visibility? }. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { businessId, mediaId } = await params;
  if (!isUuid(businessId) || !isUuid(mediaId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    assertSameOrigin(request);
    const ctx = await requireBusinessAccess(businessId, "media.manage", { throwOnly: true });
    const patch = MediaPatchSchema.parse(await request.json());
    const { before, after } = await updateMediaMetadata(ctx.db, businessId, mediaId, patch);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "media.updated", entityType: "media", entityId: mediaId, before: { title: before.title, altText: before.altText, caption: before.caption, tags: before.tags, folderId: before.folderId, visibility: before.visibility }, after: { title: after.title, altText: after.altText, caption: after.caption, tags: after.tags, folderId: after.folderId, visibility: after.visibility } });
    return NextResponse.json({ item: await toMediaListItem(after) });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE — soft delete (moves to trash). */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { businessId, mediaId } = await params;
  if (!isUuid(businessId) || !isUuid(mediaId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    assertSameOrigin(request);
    const ctx = await requireBusinessAccess(businessId, "media.manage", { throwOnly: true });
    const media = await ctx.db.media.findFirst({ where: { id: mediaId, businessId, deletedAt: null }, select: { id: true } });
    if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await deleteMedia(businessId, mediaId, ctx.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
