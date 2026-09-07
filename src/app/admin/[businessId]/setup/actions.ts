"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessAccess } from "@/lib/authz";
import { ok, runAction, type ActionResult } from "@/lib/actions";
import { publishBusiness, unpublishBusiness } from "@/lib/business/publish";
import { platformDb } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { isUuid } from "@/lib/ids";
import { toJson } from "@/lib/json";

export async function publishBusinessAction(businessId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "business.publish", { throwOnly: true });
    await publishBusiness(businessId, { actorUserId: ctx.user.id });
    revalidatePath(`/admin/${businessId}`, "layout");
    return ok(undefined, "Business published");
  });
}

export async function unpublishBusinessAction(businessId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "business.publish", { throwOnly: true });
    await unpublishBusiness(businessId, { actorUserId: ctx.user.id });
    revalidatePath(`/admin/${businessId}`, "layout");
    return ok(undefined, "Business unpublished");
  });
}

/** Sets the logo on the business and in the theme draft (published on the next theme publish). */
export async function setLogoAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    const mediaId = String(formData.get("logoMediaId") ?? "");
    const value = isUuid(mediaId) ? mediaId : null;
    if (value) {
      const media = await ctx.db.media.findFirst({ where: { id: value, businessId, kind: "IMAGE" }, select: { id: true } });
      if (!media) throw new Error("Choose an image from this business's media library.");
    }
    const theme = await ctx.db.businessTheme.findUniqueOrThrow({ where: { businessId } });
    const draft = { ...(theme.draft as Record<string, unknown>), logoMediaId: value };
    await ctx.db.businessTheme.update({ where: { businessId }, data: { draft: toJson(draft) } });
    await platformDb.business.update({ where: { id: businessId }, data: { logoMediaId: value } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "business.logo_updated", entityType: "business", entityId: businessId, after: { logoMediaId: value } });
    revalidatePath(`/admin/${businessId}/setup`);
    return ok(undefined, value ? "Logo saved. Publish the theme to show it on the site." : "Logo removed");
  });
}
