import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { requireBusinessAccess, AuthorizationError } from "@/lib/authz";
import { assertSameOrigin, CsrfError } from "@/lib/auth/csrf";
import { recordAudit } from "@/lib/audit";
import { isUuid } from "@/lib/ids";
import { MediaError, transformMedia } from "@/lib/media/service";
import { toMediaListItem } from "@/lib/media/library";

export const dynamic = "force-dynamic";

const TransformSchema = z.object({
  rotate: z.number().int().min(-360).max(360).optional(),
  crop: z.object({ left: z.number().min(0), top: z.number().min(0), width: z.number().min(1), height: z.number().min(1) }).optional(),
  flip: z.boolean().optional(),
  flop: z.boolean().optional(),
});

/** POST { rotate?, crop?{left,top,width,height}, flip?, flop? } — rewrites the image in place (same id). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ businessId: string; mediaId: string }> }) {
  const { businessId, mediaId } = await params;
  if (!isUuid(businessId) || !isUuid(mediaId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    assertSameOrigin(request);
    const ctx = await requireBusinessAccess(businessId, "media.manage", { throwOnly: true });
    const ops = TransformSchema.parse(await request.json());
    if (!ops.rotate && !ops.crop && !ops.flip && !ops.flop) return NextResponse.json({ error: "Nothing to apply" }, { status: 422 });
    const existing = await ctx.db.media.findFirst({ where: { id: mediaId, businessId, deletedAt: null }, select: { id: true, width: true, height: true } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const media = await transformMedia(businessId, mediaId, ops, ctx.user.id);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "media.transformed", entityType: "media", entityId: mediaId, before: { width: existing.width, height: existing.height }, after: { width: media.width, height: media.height }, metadata: ops });
    return NextResponse.json({ item: await toMediaListItem(media) });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof CsrfError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof MediaError) return NextResponse.json({ error: error.message }, { status: 422 });
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 422 });
    console.error("[media transform]", error);
    return NextResponse.json({ error: "Edit failed" }, { status: 500 });
  }
}
