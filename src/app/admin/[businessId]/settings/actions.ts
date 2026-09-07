"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/authz";
import { bool, fail, formToObject, ok, runAction, str, type ActionResult } from "@/lib/actions";
import { BusinessDetailsSchema, LocationSchema, archiveBusiness, requestBusinessDeletion, saveLocation, updateBusinessDetails, updateBusinessSettings } from "@/lib/business/settings";
import { isUuid } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";

const strOrUndef = (v: unknown) => (typeof v === "string" ? v : undefined);

export async function saveDetailsAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "business.settings", { throwOnly: true });
    const o = formToObject(formData);
    const input = BusinessDetailsSchema.parse({ ...o, taxInclusive: bool(o.taxInclusive), foundedYear: str(o.foundedYear) === "" ? "" : o.foundedYear, email: strOrUndef(o.email) ?? "" });
    await updateBusinessDetails(businessId, input, ctx.user.id);
    revalidatePath(`/admin/${businessId}`, "layout");
    return ok(undefined, "Details saved");
  });
}

export async function saveLocationAction(businessId: string, locationId: string | null, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "business.settings", { throwOnly: true });
    const o = formToObject(formData);
    const hours = Array.isArray(o.openingHours) ? o.openingHours : [];
    const input = LocationSchema.parse({ ...o, isPrimary: bool(o.isPrimary), isActive: o.isActive === undefined ? true : bool(o.isActive), openingHours: hours, email: strOrUndef(o.email) ?? "" });
    await saveLocation(ctx.db, businessId, input, ctx.user.id, locationId && isUuid(locationId) ? locationId : undefined);
    revalidatePath(`/admin/${businessId}/settings/locations`);
    return ok(undefined, "Location saved");
  });
}

export async function deleteLocationAction(businessId: string, locationId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "business.settings", { throwOnly: true });
    await ctx.db.businessLocation.update({ where: { id: locationId }, data: { deletedAt: new Date(), isActive: false, isPrimary: false } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "location.archived", entityType: "business_location", entityId: locationId });
    revalidatePath(`/admin/${businessId}/settings/locations`);
    return ok(undefined, "Location removed");
  });
}

export async function saveTerminologyAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "business.settings", { throwOnly: true });
    const o = formToObject(formData);
    const terminology = z.record(z.string().max(40), z.string().max(80)).parse(o.terminology ?? {});
    await updateBusinessSettings(businessId, { terminology }, ctx.user.id, "business.terminology.updated");
    revalidatePath(`/admin/${businessId}`, "layout");
    return ok(undefined, "Terminology saved");
  });
}

export async function saveNotificationsAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "business.settings", { throwOnly: true });
    const o = formToObject(formData);
    const emails = (list: unknown) => str(list).split(/[,\n]/).map((e) => e.trim().toLowerCase()).filter((e) => e && z.string().email().safeParse(e).success);
    const social: Record<string, string> = {};
    for (const k of ["facebook", "instagram", "linkedin", "youtube", "tiktok", "google"]) if (str(o[`social.${k}`])) social[k] = str(o[`social.${k}`]).slice(0, 300);
    await updateBusinessSettings(businessId, {
      notifications: { leadEmails: emails(o.leadEmails), quoteEmails: emails(o.quoteEmails) },
      paymentInstructions: str(o.paymentInstructions).slice(0, 4000),
      estimateDisclaimer: str(o.estimateDisclaimer).slice(0, 1000),
      social,
    }, ctx.user.id, "business.notifications.updated");
    revalidatePath(`/admin/${businessId}/settings/notifications`);
    return ok(undefined, "Saved");
  });
}

export async function archiveBusinessAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "business.settings", { throwOnly: true });
    if (str(formData.get("confirmName")) !== ctx.business.name) return fail("Type the business name exactly to confirm.");
    await archiveBusiness(businessId, ctx.user.id);
    return ok(undefined);
  });
  if (result.ok) redirect("/admin");
  return result;
}

export async function requestDeletionAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "business.settings", { throwOnly: true });
    await requestBusinessDeletion(businessId, ctx.user.id, str(formData.get("reason")) || "No reason given");
    return ok(undefined, "Deletion request sent to the platform team.");
  });
}
