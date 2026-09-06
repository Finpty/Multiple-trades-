import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { emitEvent } from "@/lib/events";
import { sendMail } from "@/lib/mail";
import { env } from "@/lib/env";
import { hashPassword, needsRehash, validatePasswordStrength, verifyPassword } from "./password";
import { enforceRateLimit } from "./rate-limit";
import {
  clearSessionCookie,
  createSession,
  getCurrentSession,
  invalidateAllUserSessions,
  invalidateSession,
  requestMeta,
  setSessionCookie,
} from "./session";
import { consumeAuthToken, createAuthToken } from "./tokens";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

const normaliseEmail = (email: string) => email.trim().toLowerCase();

export async function loginWithPassword(input: { email: string; password: string }): Promise<User> {
  const email = normaliseEmail(input.email);
  const meta = await requestMeta();
  await enforceRateLimit("login:email", email, { limit: 10, windowSeconds: 15 * 60 });
  if (meta.ip) await enforceRateLimit("login:ip", meta.ip, { limit: 50, windowSeconds: 15 * 60 });

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user?.passwordHash ? await verifyPassword(user.passwordHash, input.password) : false;
  if (!user || !ok) {
    // Constant-ish time: still hash on unknown user to avoid enumeration by timing.
    if (!user) await hashPassword(input.password);
    await recordAudit({
      actorUserId: user?.id ?? null,
      action: "auth.login.failed",
      entityType: "user",
      entityId: user?.id ?? null,
      severity: "WARNING",
      metadata: { email },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    throw new AuthError("Invalid email or password.");
  }
  if (user.status !== "ACTIVE" || user.deletedAt) throw new AuthError("This account is not active.");

  if (user.passwordHash && needsRehash(user.passwordHash)) {
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.password) } });
  }

  const { token, session } = await createSession(user.id, meta);
  await setSessionCookie(token, session.expiresAt);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await recordAudit({
    actorUserId: user.id,
    action: "auth.login.success",
    entityType: "user",
    entityId: user.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return user;
}

export async function logout(): Promise<void> {
  const { session, user } = await getCurrentSession();
  if (session) {
    await invalidateSession(session.id);
    await recordAudit({ actorUserId: user.id, action: "auth.logout", entityType: "user", entityId: user.id });
  }
  await clearSessionCookie();
}

export async function registerUser(input: {
  email: string;
  password: string;
  name: string;
  sendVerification?: boolean;
}): Promise<User> {
  const email = normaliseEmail(input.email);
  const weak = validatePasswordStrength(input.password);
  if (weak) throw new AuthError(weak);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AuthError("An account with this email already exists.");
  const user = await prisma.user.create({
    data: { email, name: input.name.trim(), passwordHash: await hashPassword(input.password) },
  });
  await recordAudit({ actorUserId: user.id, action: "auth.register", entityType: "user", entityId: user.id });
  await emitEvent({ type: "user.registered", payload: { userId: user.id, email }, actorUserId: user.id });
  if (input.sendVerification !== false) await sendVerificationEmail(user);
  return user;
}

export async function sendVerificationEmail(user: Pick<User, "id" | "email" | "name">): Promise<void> {
  const { token } = await createAuthToken({ type: "EMAIL_VERIFICATION", email: user.email, userId: user.id });
  const url = `${env().PLATFORM_URL}/auth/verify?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: user.email,
    subject: "Verify your email",
    text: `Hi ${user.name},\n\nConfirm your email address by opening this link:\n${url}\n\nThe link expires in 24 hours.`,
  });
}

export async function verifyEmailToken(token: string): Promise<boolean> {
  const record = await consumeAuthToken("EMAIL_VERIFICATION", token);
  if (!record?.userId) return false;
  await prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
  await recordAudit({ actorUserId: record.userId, action: "auth.email.verified", entityType: "user", entityId: record.userId });
  return true;
}

/** Always succeeds from the caller's perspective to prevent account enumeration. */
export async function requestPasswordReset(emailInput: string): Promise<void> {
  const email = normaliseEmail(emailInput);
  await enforceRateLimit("reset:email", email, { limit: 5, windowSeconds: 60 * 60 });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE") return;
  const { token } = await createAuthToken({ type: "PASSWORD_RESET", email, userId: user.id });
  const url = `${env().PLATFORM_URL}/auth/reset?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: email,
    subject: "Reset your password",
    text: `Hi ${user.name},\n\nReset your password by opening this link:\n${url}\n\nIf you did not request this, ignore this email. The link expires in 1 hour.`,
  });
  await recordAudit({ actorUserId: user.id, action: "auth.password.reset_requested", entityType: "user", entityId: user.id, severity: "NOTICE" });
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  const weak = validatePasswordStrength(newPassword);
  if (weak) throw new AuthError(weak);
  const record = await consumeAuthToken("PASSWORD_RESET", token);
  if (!record?.userId) throw new AuthError("This reset link is invalid or has expired.");
  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash: await hashPassword(newPassword), emailVerifiedAt: new Date() },
  });
  await invalidateAllUserSessions(record.userId);
  await recordAudit({ actorUserId: record.userId, action: "auth.password.reset", entityType: "user", entityId: record.userId, severity: "NOTICE" });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const weak = validatePasswordStrength(newPassword);
  if (weak) throw new AuthError(weak);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash || !(await verifyPassword(user.passwordHash, currentPassword))) {
    throw new AuthError("Current password is incorrect.");
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
  await invalidateAllUserSessions(userId);
  await recordAudit({ actorUserId: userId, action: "auth.password.changed", entityType: "user", entityId: userId, severity: "NOTICE" });
}

/** Used by admins to (re)send an invitation that lets a user set their own password. */
export async function createInviteToken(email: string, metadata: Record<string, unknown>): Promise<string> {
  const { token } = await createAuthToken({ type: "INVITE", email: normaliseEmail(email), metadata });
  return `${env().PLATFORM_URL}/auth/accept-invite?token=${encodeURIComponent(token)}`;
}
