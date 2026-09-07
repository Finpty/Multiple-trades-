"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessAccess } from "@/lib/authz";
import { formToObject, ok, runAction, type ActionResult } from "@/lib/actions";
import { InviteSchema, changeMemberRole, inviteMember, removeMember, resendInvite, setMemberStatus } from "@/lib/business/members";

export async function inviteAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "users.manage", { throwOnly: true });
    const input = InviteSchema.parse(formToObject(formData));
    const r = await inviteMember(ctx.db, ctx.business, input, ctx.user.id);
    revalidatePath(`/admin/${businessId}/users`);
    return ok(undefined, r.created ? "Invitation sent." : "Access granted and the user notified.");
  });
}

export async function changeRoleAction(businessId: string, membershipId: string, roleId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "users.manage", { throwOnly: true });
    await changeMemberRole(ctx.db, businessId, membershipId, roleId, ctx.user.id);
    revalidatePath(`/admin/${businessId}/users`);
    return ok(undefined, "Role updated");
  });
}

export async function setStatusAction(businessId: string, membershipId: string, status: "ACTIVE" | "SUSPENDED"): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "users.manage", { throwOnly: true });
    await setMemberStatus(ctx.db, businessId, membershipId, status, ctx.user.id);
    revalidatePath(`/admin/${businessId}/users`);
    return ok(undefined, status === "ACTIVE" ? "Member reactivated" : "Member suspended");
  });
}

export async function removeMemberAction(businessId: string, membershipId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "users.manage", { throwOnly: true });
    await removeMember(ctx.db, businessId, membershipId, ctx.user.id);
    revalidatePath(`/admin/${businessId}/users`);
    return ok(undefined, "Member removed");
  });
}

export async function resendInviteAction(businessId: string, membershipId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "users.manage", { throwOnly: true });
    await resendInvite(ctx.db, ctx.business, membershipId, ctx.user.id);
    return ok(undefined, "Invitation resent");
  });
}
