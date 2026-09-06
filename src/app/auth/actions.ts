"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuthError, registerUser, requestPasswordReset, resetPasswordWithToken } from "@/lib/auth/service";
import { consumeAuthToken } from "@/lib/auth/tokens";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { createSession, requestMeta, setSessionCookie } from "@/lib/auth/session";
import { RateLimitError, enforceRateLimit } from "@/lib/auth/rate-limit";
import { recordAudit } from "@/lib/audit";
import { getPlatformSetting } from "@/lib/platform/settings";
import { asObject } from "@/lib/json";

export type AuthFormState = { error?: string; success?: string } | undefined;

function message(error: unknown): AuthFormState {
  if (error instanceof AuthError || error instanceof RateLimitError) return { error: error.message };
  throw error;
}

export async function forgotAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = z.string().email().safeParse(String(formData.get("email") ?? "").trim());
  if (!email.success) return { error: "Enter a valid email address." };
  try {
    await requestPasswordReset(email.data);
  } catch (error) {
    return message(error);
  }
  return { success: "If an account exists for that email, a reset link has been sent." };
}

export async function resetAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) return { error: "Passwords do not match." };
  try {
    await resetPasswordWithToken(token, password);
  } catch (error) {
    return message(error);
  }
  redirect("/login?reset=1");
}

export async function acceptInviteAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const meta = await requestMeta();
  if (meta.ip) {
    try {
      await enforceRateLimit("invite:ip", meta.ip, { limit: 20, windowSeconds: 900 });
    } catch (error) {
      return message(error);
    }
  }
  const record = await consumeAuthToken("INVITE", token);
  if (!record) return { error: "This invitation link is invalid or has expired. Ask for a new invite." };
  const user = await prisma.user.findUnique({ where: { email: record.email } });
  if (!user) return { error: "The invited account no longer exists." };
  const needsPassword = !user.passwordHash;
  if (needsPassword) {
    if (!name) return { error: "Enter your name." };
    const weak = validatePasswordStrength(password);
    if (weak) return { error: weak };
  }
  const metadata = asObject<{ businessId?: string; organizationId?: string }>(record.metadata);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE", emailVerifiedAt: user.emailVerifiedAt ?? new Date(), ...(needsPassword ? { name, passwordHash: await hashPassword(password) } : {}) },
    });
    const now = new Date();
    if (metadata.businessId) await tx.businessMembership.updateMany({ where: { userId: user.id, businessId: metadata.businessId, status: "INVITED" }, data: { status: "ACTIVE", acceptedAt: now } });
    if (metadata.organizationId) await tx.organizationMembership.updateMany({ where: { userId: user.id, organizationId: metadata.organizationId, status: "INVITED" }, data: { status: "ACTIVE", acceptedAt: now } });
    if (!metadata.businessId && !metadata.organizationId) {
      await tx.businessMembership.updateMany({ where: { userId: user.id, status: "INVITED" }, data: { status: "ACTIVE", acceptedAt: now } });
      await tx.organizationMembership.updateMany({ where: { userId: user.id, status: "INVITED" }, data: { status: "ACTIVE", acceptedAt: now } });
    }
  });
  await recordAudit({ actorUserId: user.id, businessId: metadata.businessId ?? null, organizationId: metadata.organizationId ?? null, action: "auth.invite.accepted", entityType: "user", entityId: user.id, severity: "NOTICE", ip: meta.ip, userAgent: meta.userAgent });
  const { token: sessionToken, session } = await createSession(user.id, meta);
  await setSessionCookie(sessionToken, session.expiresAt);
  redirect("/admin");
}

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!(await getPlatformSetting<boolean>("registration.enabled", false))) return { error: "Registration is not open." };
  const parsed = z.object({ name: z.string().min(1).max(120), email: z.string().email(), password: z.string() }).safeParse({ name: String(formData.get("name") ?? "").trim(), email: String(formData.get("email") ?? "").trim(), password: String(formData.get("password") ?? "") });
  if (!parsed.success) return { error: "Enter your name, a valid email and a password." };
  const meta = await requestMeta();
  try {
    if (meta.ip) await enforceRateLimit("register:ip", meta.ip, { limit: 10, windowSeconds: 3600 });
    const user = await registerUser(parsed.data);
    const { token, session } = await createSession(user.id, meta);
    await setSessionCookie(token, session.expiresAt);
  } catch (error) {
    return message(error);
  }
  redirect("/admin");
}
