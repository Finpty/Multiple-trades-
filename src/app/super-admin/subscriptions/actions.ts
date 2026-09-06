"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/authz";
import { formToObject, ok, runAction, str, type ActionResult } from "@/lib/actions";
import { isUuid } from "@/lib/ids";
import { SubscriptionSchema, cancelSubscription, createSubscription, updateSubscription } from "./service";

function revalidate(id?: string, businessId?: string | null) {
  revalidatePath("/super-admin/subscriptions");
  if (id) revalidatePath(`/super-admin/subscriptions/${id}`);
  if (businessId) revalidatePath(`/super-admin/businesses/${businessId}/subscriptions`);
}

export async function createSubscriptionAction(_prev: ActionResult<{ id: string }> | undefined, formData: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const input = SubscriptionSchema.parse(formToObject(formData));
    const row = await createSubscription(input, user.id);
    revalidate(row.id, row.businessId);
    return ok({ id: row.id }, "Subscription created.");
  });
}

export async function updateSubscriptionAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const id = str(formData.get("subscriptionId"));
    if (!isUuid(id)) throw new Error("Invalid subscription id.");
    const input = SubscriptionSchema.parse(formToObject(formData));
    const row = await updateSubscription(id, input, user.id);
    revalidate(row.id, row.businessId);
    return ok(undefined, "Subscription saved.");
  });
}

export async function cancelSubscriptionAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const id = str(formData.get("subscriptionId"));
    if (!isUuid(id)) throw new Error("Invalid subscription id.");
    const row = await cancelSubscription(id, user.id, str(formData.get("reason")) || undefined);
    revalidate(row.id, row.businessId);
    return ok(undefined, "Subscription cancelled.");
  });
}
