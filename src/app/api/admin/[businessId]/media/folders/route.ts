import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { requireBusinessAccess, AuthorizationError } from "@/lib/authz";
import { assertSameOrigin, CsrfError } from "@/lib/auth/csrf";
import { recordAudit } from "@/lib/audit";
import { isUuid } from "@/lib/ids";
import { FolderNameSchema, MediaLibraryError, createFolder, deleteFolder, listFolders, moveFolder, renameFolder } from "@/lib/media/library";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ businessId: string }> };

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof CsrfError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof MediaLibraryError) return NextResponse.json({ error: error.message }, { status: 422 });
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 422 });
  console.error("[media folders]", error);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

const nullableId = z.preprocess((v) => (typeof v === "string" && v ? v : null), z.string().uuid().nullable());

/** GET — flat folder list with media counts. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { businessId } = await params;
  if (!isUuid(businessId)) return NextResponse.json({ error: "Invalid business" }, { status: 400 });
  try {
    const ctx = await requireBusinessAccess(businessId, "media.manage", { throwOnly: true });
    return NextResponse.json({ folders: await listFolders(ctx.db, businessId) });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST { name, parentId? } — create. */
export async function POST(request: NextRequest, { params }: Params) {
  const { businessId } = await params;
  if (!isUuid(businessId)) return NextResponse.json({ error: "Invalid business" }, { status: 400 });
  try {
    assertSameOrigin(request);
    const ctx = await requireBusinessAccess(businessId, "media.manage", { throwOnly: true });
    const body = z.object({ name: FolderNameSchema, parentId: nullableId.optional() }).parse(await request.json());
    const folder = await createFolder(ctx.db, businessId, body.name, body.parentId ?? null);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "media_folder.created", entityType: "media_folder", entityId: folder.id, after: { name: folder.name, parentId: folder.parentId } });
    return NextResponse.json({ folder, folders: await listFolders(ctx.db, businessId) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH { id, name? , parentId? } — rename and/or move. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { businessId } = await params;
  if (!isUuid(businessId)) return NextResponse.json({ error: "Invalid business" }, { status: 400 });
  try {
    assertSameOrigin(request);
    const ctx = await requireBusinessAccess(businessId, "media.manage", { throwOnly: true });
    const body = z.object({ id: z.string().uuid(), name: FolderNameSchema.optional(), parentId: nullableId.optional() }).parse(await request.json());
    if (body.name !== undefined) {
      const { before, after } = await renameFolder(ctx.db, businessId, body.id, body.name);
      await recordAudit({ actorUserId: ctx.user.id, businessId, action: "media_folder.renamed", entityType: "media_folder", entityId: body.id, before: { name: before.name }, after: { name: after.name } });
    }
    if (body.parentId !== undefined) {
      const { before, after } = await moveFolder(ctx.db, businessId, body.id, body.parentId);
      await recordAudit({ actorUserId: ctx.user.id, businessId, action: "media_folder.moved", entityType: "media_folder", entityId: body.id, before: { parentId: before.parentId }, after: { parentId: after.parentId } });
    }
    return NextResponse.json({ folders: await listFolders(ctx.db, businessId) });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE ?id=&moveContents=1 — delete (empty only, or move contents to the parent). */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { businessId } = await params;
  if (!isUuid(businessId)) return NextResponse.json({ error: "Invalid business" }, { status: 400 });
  try {
    assertSameOrigin(request);
    const ctx = await requireBusinessAccess(businessId, "media.manage", { throwOnly: true });
    const id = request.nextUrl.searchParams.get("id");
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid folder id" }, { status: 400 });
    const moveContents = request.nextUrl.searchParams.get("moveContents") === "1";
    const folder = await deleteFolder(ctx.db, businessId, id, moveContents);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "media_folder.deleted", entityType: "media_folder", entityId: id, before: { name: folder.name, parentId: folder.parentId }, metadata: { moveContents } });
    return NextResponse.json({ folders: await listFolders(ctx.db, businessId) });
  } catch (error) {
    return errorResponse(error);
  }
}
