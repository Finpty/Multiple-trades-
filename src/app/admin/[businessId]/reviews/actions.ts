"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/authz";
import { formToObject, ok, runAction, str, type ActionResult } from "@/lib/actions";
import { isUuid } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import { ReviewInputSchema, ReviewReorderSchema, archiveReview, createReview, reorderReviews, restoreReview, setReviewFlag, updateReview } from "@/lib/content/reviews";

const base = (b: string) => `/admin/${b}/reviews`;
function idOf(v: unknown, what: string): string {
  const s = str(v);
  if (!isUuid(s)) throw new z.ZodError([{ code: "custom", path: [what], message: `Invalid ${what}.` }]);
  return s;
}

export async function saveReviewAction(_prev: ActionResult<{ id: string; created: boolean }> | undefined, formData: FormData): Promise<ActionResult<{ id: string; created: boolean }>> {
  return runAction<{ id: string; created: boolean }>(async () => {
    const businessId = idOf(formData.get("businessId"), "business");
    const ctx = await requireBusinessAccess(businessId, "business.settings", { throwOnly: true });
    const obj = formToObject(formData);
    const reviewId = str(obj.reviewId) ? idOf(obj.reviewId, "review") : null;
    const input = ReviewInputSchema.parse(obj);
    if (!reviewId) {
      const r = await createReview(ctx.db, businessId, input);
      await recordAudit({ actorUserId: ctx.user.id, businessId, action: "review.created", entityType: "review", entityId: r.id, after: r });
      revalidatePath(base(businessId));
      return ok({ id: r.id, created: true }, "Review added.");
    }
    const { before, after } = await updateReview(ctx.db, businessId, reviewId, input);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "review.updated", entityType: "review", entityId: reviewId, before, after });
    revalidatePath(base(businessId));
    revalidatePath(`${base(businessId)}/${reviewId}`);
    return ok({ id: reviewId, created: false }, "Saved.");
  });
}

export async function reviewStateAction(businessId: string, reviewId: string, state: "publish" | "hide" | "feature" | "unfeature" | "archive" | "restore"): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "business.settings", { throwOnly: true });
    const id = idOf(reviewId, "review");
    if (state === "archive") await archiveReview(ctx.db, businessId, id);
    else if (state === "restore") await restoreReview(ctx.db, businessId, id);
    else if (state === "publish" || state === "hide") await setReviewFlag(ctx.db, businessId, id, "isPublished", state === "publish");
    else await setReviewFlag(ctx.db, businessId, id, "isFeatured", state === "feature");
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: `review.${state}`, entityType: "review", entityId: id });
    revalidatePath(base(businessId));
    return ok(undefined, { publish: "Review is now shown on the website.", hide: "Review hidden.", feature: "Marked as featured.", unfeature: "Removed from featured.", archive: "Archived.", restore: "Restored." }[state]);
  });
}

export async function reorderReviewsAction(businessId: string, items: Array<{ id: string; sortOrder: number }>): Promise<ActionResult<{ count: number }>> {
  return runAction<{ count: number }>(async () => {
    const ctx = await requireBusinessAccess(businessId, "business.settings", { throwOnly: true });
    const count = await reorderReviews(ctx.db, businessId, ReviewReorderSchema.parse(items));
    revalidatePath(base(businessId));
    return ok({ count });
  });
}
