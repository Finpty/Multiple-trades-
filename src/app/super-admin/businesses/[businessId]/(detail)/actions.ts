"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/authz";
import { formToObject, ok, runAction, str, type ActionResult } from "@/lib/actions";
import { isUuid } from "@/lib/ids";
import { publishBusiness, unpublishBusiness } from "@/lib/business/publish";
import {
  BusinessDetailsSchema,
  addBusinessMember,
  archiveBusiness,
  changeBusinessMemberRole,
  removeBusinessMember,
  restoreBusiness,
  suspendBusiness,
  unsuspendBusiness,
  updateBusinessDetails,
} from "@/lib/platform/businesses";

function revalidate(businessId: string) {
  revalidatePath(`/super-admin/businesses/${businessId}`, "layout");
  revalidatePath("/super-admin/businesses");
  revalidatePath("/super-admin");
}

function businessIdFrom(formData: FormData): string {
  const id = str(formData.get("businessId"));
  if (!isUuid(id)) throw new Error("Invalid business id.");
  return id;
}

export async function publishBusinessAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const businessId = businessIdFrom(formData);
    await publishBusiness(businessId, { actorUserId: user.id });
    revalidate(businessId);
    return ok(undefined, "Business published.");
  });
}

export async function unpublishBusinessAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const businessId = businessIdFrom(formData);
    await unpublishBusiness(businessId, { actorUserId: user.id });
    revalidate(businessId);
    return ok(undefined, "Business unpublished.");
  });
}

export async function suspendBusinessAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const businessId = businessIdFrom(formData);
    await suspendBusiness(businessId, user.id, str(formData.get("reason")) || undefined);
    revalidate(businessId);
    return ok(undefined, "Business suspended.");
  });
}

export async function unsuspendBusinessAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const businessId = businessIdFrom(formData);
    await unsuspendBusiness(businessId, user.id);
    revalidate(businessId);
    return ok(undefined, "Suspension lifted.");
  });
}

export async function archiveBusinessAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const businessId = businessIdFrom(formData);
    await archiveBusiness(businessId, user.id);
    revalidate(businessId);
    return ok(undefined, "Business archived.");
  });
}

export async function restoreBusinessAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const businessId = businessIdFrom(formData);
    await restoreBusiness(businessId, user.id);
    revalidate(businessId);
    return ok(undefined, "Business restored.");
  });
}

export async function updateBusinessDetailsAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const businessId = businessIdFrom(formData);
    const input = BusinessDetailsSchema.parse(formToObject(formData));
    await updateBusinessDetails(businessId, input, user.id);
    revalidate(businessId);
    return ok(undefined, "Business details saved.");
  });
}

const AddMemberSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  name: z.string().trim().max(120).optional(),
  roleId: z.string().uuid("Choose a role"),
  title: z.string().trim().max(80).optional(),
});

export async function addMemberAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const businessId = businessIdFrom(formData);
    const input = AddMemberSchema.parse(formToObject(formData));
    const result = await addBusinessMember(businessId, input, user.id);
    revalidate(businessId);
    revalidatePath("/super-admin/users");
    return ok(undefined, result.created ? "User created and invitation sent." : result.user.status === "INVITED" ? "Member added and invitation re-sent." : "Member added.");
  });
}

export async function changeMemberRoleAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const businessId = businessIdFrom(formData);
    const membershipId = str(formData.get("membershipId"));
    const roleId = str(formData.get("roleId"));
    if (!isUuid(membershipId) || !isUuid(roleId)) throw new Error("Invalid selection.");
    await changeBusinessMemberRole(businessId, membershipId, roleId, user.id);
    revalidate(businessId);
    return ok(undefined, "Role updated.");
  });
}

export async function removeMemberAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const businessId = businessIdFrom(formData);
    const membershipId = str(formData.get("membershipId"));
    if (!isUuid(membershipId)) throw new Error("Invalid selection.");
    await removeBusinessMember(businessId, membershipId, user.id);
    revalidate(businessId);
    return ok(undefined, "Member removed.");
  });
}
