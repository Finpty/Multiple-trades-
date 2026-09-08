import { NextResponse, type NextRequest } from "next/server";
import { requireBusinessAccess, AuthorizationError } from "@/lib/authz";
import { assertSameOrigin, CsrfError } from "@/lib/auth/csrf";
import { MediaError, mediaUrls, uploadMedia } from "@/lib/media/service";
import { MEDIA_SORTS, listLibraryMedia, type MediaSort } from "@/lib/media/library";
import { isUuid } from "@/lib/ids";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/:businessId/media — list media for pickers and the library.
 * Query: kind=IMAGE|VIDEO|DOCUMENT|OTHER, q=, folderId=<uuid>|root (unfiled; omit = every folder),
 * tag=, sort=newest|oldest|name|size, trashed=1, page=, pageSize= (≤200, default 48).
 * Soft-deleted files are excluded unless trashed=1.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) return NextResponse.json({ error: "Invalid business" }, { status: 400 });
  try {
    const ctx = await requireBusinessAccess(businessId, "media.manage", { throwOnly: true });
    const sp = request.nextUrl.searchParams;
    const kind = sp.get("kind");
    const folderParam = sp.get("folderId");
    const sortParam = sp.get("sort");
    const result = await listLibraryMedia(ctx.db, businessId, {
      kind: kind && ["IMAGE", "VIDEO", "DOCUMENT", "OTHER"].includes(kind) ? (kind as "IMAGE") : null,
      q: sp.get("q")?.trim(),
      folderId: folderParam === "root" ? null : folderParam && isUuid(folderParam) ? folderParam : undefined,
      tag: sp.get("tag")?.trim() || null,
      sort: MEDIA_SORTS.includes(sortParam as MediaSort) ? (sortParam as MediaSort) : "newest",
      trashed: sp.get("trashed") === "1",
      page: Math.max(1, Number(sp.get("page") ?? 1)),
      pageSize: Math.min(200, Math.max(1, Number(sp.get("pageSize") ?? 48))),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

/** POST multipart/form-data { file, folderId?, altText?, visibility?, folderKey? } — upload. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) return NextResponse.json({ error: "Invalid business" }, { status: 400 });
  try {
    assertSameOrigin(request);
    const ctx = await requireBusinessAccess(businessId, "media.manage", { throwOnly: true });
    const form = await request.formData();
    const files = form.getAll("file").filter((f): f is File => f instanceof File);
    if (files.length === 0) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    const folderId = (form.get("folderId") as string | null) || null;
    const visibility = form.get("visibility") === "PRIVATE" ? "PRIVATE" : "PUBLIC";
    const altText = (form.get("altText") as string | null) || null;
    const folderKey = (form.get("folderKey") as string | null) || "uploads";
    const results = [];
    for (const file of files) {
      const media = await uploadMedia({
        businessId,
        buffer: Buffer.from(await file.arrayBuffer()),
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        folderId: folderId && isUuid(folderId) ? folderId : null,
        visibility,
        altText,
        uploadedByUserId: ctx.user.id,
        folderKey: folderKey.replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "uploads",
      });
      results.push({ ...(await mediaUrls(media)), title: media.title, originalName: media.originalName, sizeBytes: Number(media.sizeBytes), folderId: media.folderId });
    }
    return NextResponse.json({ items: results }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof CsrfError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof MediaError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error("[media upload]", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
