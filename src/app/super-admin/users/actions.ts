"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PlatformRole } from "@prisma/client";
import { requirePlatformAdmin } from "@/lib/authz";
import { formToObject, ok, runAction, str, type ActionResult } from "@/lib/actions";
import { isUuid } from "@/lib/ids";
import {
  PLATFORM_ROLES,
  activateUser,
  changePlatformRole,
  invitePlatformUser,
  resendInvite,
  revokeUserSession,
  sendPasswordResetForUser,
  signOutUserEverywhere,
  suspendUser,
  updateUserProfile,
} from "@/lib/platform/users";

function revalidate(userId?: string) {
  revalidatePath("/super-admin/users");
  if (userId) revalidatePath(`/super-admin/users/${userId}`);
  revalidatePath("/super-admin");
}

function userIdFrom(formData: FormData): string {
  const id = str(formData.get("userId"));
  if (!isUuid(id)) throw new Error("Invalid user id.");
  return id;
}

const InviteSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  email: z.string().trim().email("Enter a valid email address"),
  platformRole: z.enum(["NONE", "SUPPORT", "ADMIN", "OWNER"]),
});

export async function inviteUserAction(_prev: ActionResult<{ userId: string }> | undefined, formData: FormData): Promise<ActionResult<{ userId: string }>> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const input = InviteSchema.parse(formToObject(formData));
    const created = await invitePlatformUser(input, user);
    revalidate(created.id);
    return ok({ userId: created.id }, "Invitation sent.");
  });
}

const ProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  phone: z.string().trim().max(40).optional(),
  timezone: z.string().trim().max(80).optional(),
  locale: z.string().trim().max(20).optional(),
});

export async function updateProfileAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const userId = userIdFrom(formData);
    const input = ProfileSchema.parse(formToObject(formData));
    await updateUserProfile(userId, { name: input.name, phone: input.phone ?? null, timezone: input.timezone || undefined, locale: input.locale || undefined }, user);
    revalidate(userId);
    return ok(undefined, "Profile saved.");
  });
}

export async function changePlatformRoleAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const userId = userIdFrom(formData);
    const role = str(formData.get("platformRole"));
    if (!PLATFORM_ROLES.includes(role as PlatformRole)) throw new Error("Unknown platform role.");
    await changePlatformRole(userId, role as PlatformRole, user);
    revalidate(userId);
    return ok(undefined, `Platform role set to ${role}.`);
  });
}

export async function suspendUserAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const userId = userIdFrom(formData);
    await suspendUser(userId, user);
    revalidate(userId);
    return ok(undefined, "User suspended and signed out everywhere.");
  });
}

export async function activateUserAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const userId = userIdFrom(formData);
    await activateUser(userId, user);
    revalidate(userId);
    return ok(undefined, "User activated.");
  });
}

export async function sendPasswordResetAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const userId = userIdFrom(formData);
    await sendPasswordResetForUser(userId, user);
    revalidate(userId);
    return ok(undefined, "Password reset email sent.");
  });
}

export async function signOutEverywhereAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const userId = userIdFrom(formData);
    await signOutUserEverywhere(userId, user);
    revalidate(userId);
    return ok(undefined, "All sessions revoked.");
  });
}

export async function revokeSessionAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const userId = userIdFrom(formData);
    const sessionId = str(formData.get("sessionId"));
    if (!isUuid(sessionId)) throw new Error("Invalid session id.");
    await revokeUserSession(userId, sessionId, user);
    revalidate(userId);
    return ok(undefined, "Session revoked.");
  });
}

export async function resendInviteAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
    const userId = userIdFrom(formData);
    await resendInvite(userId, user);
    revalidate(userId);
    return ok(undefined, "Invitation re-sent.");
  });
}
