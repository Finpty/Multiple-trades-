"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessAccess } from "@/lib/authz";
import { fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { setBusinessFeature } from "@/lib/business/features";

export async function toggleFeatureAction(businessId: string, featureKey: string, isEnabled: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "features.manage", { throwOnly: true });
    await setBusinessFeature(ctx.db, businessId, featureKey, isEnabled, ctx.user.id);
    revalidatePath(`/admin/${businessId}`, "layout");
    return ok(undefined, isEnabled ? "Feature enabled" : "Feature disabled");
  });
}

export async function saveFeatureConfigAction(businessId: string, featureKey: string, configText: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "features.manage", { throwOnly: true });
    let config: Record<string, unknown>;
    try {
      config = configText.trim() ? (JSON.parse(configText) as Record<string, unknown>) : {};
    } catch {
      return fail("Config must be valid JSON.");
    }
    const current = await ctx.db.businessFeature.findUnique({ where: { businessId_featureKey: { businessId, featureKey } } });
    await setBusinessFeature(ctx.db, businessId, featureKey, current?.isEnabled ?? false, ctx.user.id, config);
    revalidatePath(`/admin/${businessId}/features`);
    return ok(undefined, "Config saved");
  });
}
