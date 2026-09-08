"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/authz";
import { ok, runAction, type ActionResult } from "@/lib/actions";
import { isUuid } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import { BulkMediaOpSchema, bulkUpdateMedia, emptyTrash, type BulkMediaOp } from "@/lib/media/library";

const IdList = z.array(z.string().uuid()).min(1, "Select at least one file.").max(500);

/** Applies one operation (move / tag / visibility / delete / restore / purge) to many files. */
export async function bulkMediaAction(businessId: string, ids: string[], op: BulkMediaOp): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    if (!isUuid(businessId)) throw new Error("Invalid business id.");
    const ctx = await requireBusinessAccess(businessId, "media.manage", { throwOnly: true });
    const parsedIds = IdList.parse(ids);
    const parsedOp = BulkMediaOpSchema.parse(op);
    const count = await bulkUpdateMedia(ctx.db, businessId, parsedIds, parsedOp);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: `media.bulk_${parsedOp.op}`, entityType: "media", metadata: { count, ids: parsedIds.slice(0, 100), op: parsedOp } });
    revalidatePath(`/admin/${businessId}/media`);
    const verb = { move: "moved", addTag: "tagged", removeTag: "untagged", visibility: "updated", delete: "moved to trash", restore: "restored", purge: "permanently deleted" }[parsedOp.op];
    return ok({ count }, `${count} file${count === 1 ? "" : "s"} ${verb}.`);
  });
}

/** Permanently deletes everything in the trash. */
export async function emptyTrashAction(businessId: string): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    if (!isUuid(businessId)) throw new Error("Invalid business id.");
    const ctx = await requireBusinessAccess(businessId, "media.manage", { throwOnly: true });
    const count = await emptyTrash(ctx.db, businessId);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "media.trash_emptied", entityType: "media", severity: "WARNING", metadata: { count } });
    revalidatePath(`/admin/${businessId}/media`);
    return ok({ count }, `Trash emptied (${count} file${count === 1 ? "" : "s"}).`);
  });
}
