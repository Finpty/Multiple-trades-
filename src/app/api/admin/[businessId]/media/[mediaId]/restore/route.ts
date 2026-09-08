import { NextResponse, type NextRequest } from "next/server";
import { requireBusinessAccess, AuthorizationError } from "@/lib/authz";
import { assertSameOrigin, CsrfError } from "@/lib/auth/csrf";
import { isUuid } from "@/lib/ids";
import { MediaError, restoreMedia } from "@/lib/media/service";
import { toMediaListItem } from "@/lib/media/library";

export const dynamic = "force-dynamic";

/** POST — restores a trashed file. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ businessId: string; mediaId: string }> }) {
  const { businessId, mediaId } = await params;
  if (!isUuid(businessId) || !isUuid(mediaId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    assertSameOrigin(request);
    const ctx = await requireBusinessAccess(businessId, "media.manage", { throwOnly: true });
    const media = await restoreMedia(businessId, mediaId, ctx.user.id);
    return NextResponse.json({ item: await toMediaListItem(media) });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof CsrfError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof MediaError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error("[media restore]", error);
    return NextResponse.json({ error: "Restore failed" }, { status: 500 });
  }
}
