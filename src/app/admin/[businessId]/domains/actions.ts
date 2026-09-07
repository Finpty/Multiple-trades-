"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessAccess } from "@/lib/authz";
import { ok, runAction, str, type ActionResult } from "@/lib/actions";
import { addDomain, removeDomain, setDomainRedirect, setPrimaryDomain, verifyDomain } from "@/lib/domains/service";
import { isUuid } from "@/lib/ids";

export async function addDomainAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "domains.manage", { throwOnly: true });
    await addDomain(businessId, str(formData.get("hostname")), { actorUserId: ctx.user.id, kind: "CUSTOM" });
    revalidatePath(`/admin/${businessId}/domains`);
    return ok(undefined, "Domain added. Add the DNS records shown, then verify.");
  });
}

export async function verifyDomainAction(businessId: string, domainId: string): Promise<ActionResult<{ verified: boolean; error: string | null }>> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "domains.manage", { throwOnly: true });
    const d = await verifyDomain(businessId, domainId, { actorUserId: ctx.user.id });
    revalidatePath(`/admin/${businessId}/domains`);
    return ok({ verified: d.verificationStatus === "VERIFIED", error: d.verificationError }, d.verificationStatus === "VERIFIED" ? "Domain verified" : d.verificationError ?? "Not verified yet");
  });
}

export async function setPrimaryDomainAction(businessId: string, domainId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "domains.manage", { throwOnly: true });
    await setPrimaryDomain(businessId, domainId, { actorUserId: ctx.user.id });
    revalidatePath(`/admin/${businessId}`, "layout");
    return ok(undefined, "Primary domain updated");
  });
}

export async function setRedirectAction(businessId: string, domainId: string, redirectToDomainId: string, redirectType: number): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "domains.manage", { throwOnly: true });
    await setDomainRedirect(businessId, domainId, isUuid(redirectToDomainId) ? redirectToDomainId : null, redirectType === 302 ? 302 : 301, { actorUserId: ctx.user.id });
    revalidatePath(`/admin/${businessId}/domains`);
    return ok(undefined, "Redirect saved");
  });
}

export async function removeDomainAction(businessId: string, domainId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "domains.manage", { throwOnly: true });
    await removeDomain(businessId, domainId, { actorUserId: ctx.user.id });
    revalidatePath(`/admin/${businessId}`, "layout");
    return ok(undefined, "Domain removed");
  });
}
