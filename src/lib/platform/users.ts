import type { PlatformRole, Prisma, UserStatus } from "@prisma/client";
import { platformDb, prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { hasPlatformRole } from "@/lib/authz";
import { createInviteToken, requestPasswordReset } from "@/lib/auth/service";
import { invalidateAllUserSessions, invalidateSession } from "@/lib/auth/session";
import { sendMail } from "@/lib/mail";
import { env } from "@/lib/env";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Super Admin user management. Callers must have passed
 * `requirePlatformAdmin("ADMIN")`; OWNER-only rules are enforced here again so
 * they cannot be bypassed by a page forgetting to check.
 */

export const USER_PAGE_SIZE = 25;
export const PLATFORM_ROLES: PlatformRole[] = ["NONE", "SUPPORT", "ADMIN", "OWNER"];
export const USER_STATUSES: UserStatus[] = ["ACTIVE", "INVITED", "SUSPENDED", "DELETED"];

export class UserAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserAdminError";
  }
}

export interface UserListFilters {
  q?: string;
  platformRole?: string;
  status?: string;
  page?: number;
}

export async function listUsers(filters: UserListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.UserWhereInput = { deletedAt: undefined };
  if (filters.q) where.OR = [{ name: { contains: filters.q, mode: "insensitive" } }, { email: { contains: filters.q, mode: "insensitive" } }];
  if (filters.platformRole && PLATFORM_ROLES.includes(filters.platformRole as PlatformRole)) where.platformRole = filters.platformRole as PlatformRole;
  if (filters.status && USER_STATUSES.includes(filters.status as UserStatus)) where.status = filters.status as UserStatus;
  else if (!filters.status) where.status = { not: "DELETED" };
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * USER_PAGE_SIZE,
      take: USER_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        platformRole: true,
        status: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { businessMemberships: true, organizationMemberships: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  return { rows, total, page, pageSize: USER_PAGE_SIZE, pages: Math.max(1, Math.ceil(total / USER_PAGE_SIZE)) };
}

export async function getUserDetail(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: undefined },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      platformRole: true,
      status: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      locale: true,
      timezone: true,
      mfaEnabled: true,
      sessionVersion: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      passwordHash: true,
    },
  });
  if (!user) return null;
  const [orgMemberships, bizMemberships, sessions, pendingInvite] = await Promise.all([
    platformDb.organizationMembership.findMany({ where: { userId }, include: { organization: { select: { id: true, name: true, slug: true, status: true } }, role: { select: { key: true, name: true } } }, orderBy: { createdAt: "asc" } }),
    platformDb.businessMembership.findMany({ where: { userId }, include: { business: { select: { id: true, name: true, slug: true, status: true } }, role: { select: { key: true, name: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.session.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() }, sessionVersion: user.sessionVersion }, orderBy: { lastActiveAt: "desc" }, take: 50, select: { id: true, ip: true, userAgent: true, createdAt: true, lastActiveAt: true, expiresAt: true } }),
    prisma.authToken.findFirst({ where: { userId, type: "INVITE", usedAt: null, expiresAt: { gt: new Date() } }, select: { expiresAt: true, createdAt: true } }),
  ]);
  const { passwordHash, ...safe } = user;
  return { ...safe, hasPassword: !!passwordHash, orgMemberships, bizMemberships, sessions, pendingInvite };
}

/* ── Platform role ─────────────────────────────────────────────────────────── */

export async function changePlatformRole(targetUserId: string, role: PlatformRole, actor: SessionUser) {
  if (!PLATFORM_ROLES.includes(role)) throw new UserAdminError("Unknown platform role.");
  if (targetUserId === actor.id) throw new UserAdminError("You cannot change your own platform role.");
  const target = await prisma.user.findFirst({ where: { id: targetUserId, deletedAt: undefined } });
  if (!target) throw new UserAdminError("User not found.");
  const actorIsOwner = hasPlatformRole(actor, "OWNER");
  if ((role === "OWNER" || target.platformRole === "OWNER") && !actorIsOwner) throw new UserAdminError("Only a platform OWNER can grant or revoke the OWNER role.");
  if (target.platformRole === role) return target;
  if (target.platformRole === "OWNER" && role !== "OWNER") {
    const owners = await prisma.user.count({ where: { platformRole: "OWNER", status: "ACTIVE", deletedAt: null } });
    if (owners <= 1) throw new UserAdminError("The platform must keep at least one active OWNER.");
  }
  const updated = await prisma.user.update({ where: { id: targetUserId }, data: { platformRole: role } });
  await recordAudit({ actorUserId: actor.id, action: "user.platform_role_changed", entityType: "user", entityId: targetUserId, severity: "CRITICAL", before: { platformRole: target.platformRole }, after: { platformRole: role }, metadata: { email: target.email } });
  return updated;
}

/* ── Status ────────────────────────────────────────────────────────────────── */

export async function suspendUser(targetUserId: string, actor: SessionUser) {
  if (targetUserId === actor.id) throw new UserAdminError("You cannot suspend your own account.");
  const target = await prisma.user.findFirst({ where: { id: targetUserId, deletedAt: undefined } });
  if (!target) throw new UserAdminError("User not found.");
  if (target.status === "SUSPENDED") throw new UserAdminError("This user is already suspended.");
  if (target.platformRole === "OWNER" && !hasPlatformRole(actor, "OWNER")) throw new UserAdminError("Only a platform OWNER can suspend another OWNER.");
  const updated = await prisma.user.update({ where: { id: targetUserId }, data: { status: "SUSPENDED" } });
  await invalidateAllUserSessions(targetUserId);
  await recordAudit({ actorUserId: actor.id, action: "user.suspended", entityType: "user", entityId: targetUserId, severity: "CRITICAL", before: { status: target.status }, after: { status: "SUSPENDED" }, metadata: { email: target.email } });
  return updated;
}

export async function activateUser(targetUserId: string, actor: SessionUser) {
  const target = await prisma.user.findFirst({ where: { id: targetUserId, deletedAt: undefined } });
  if (!target) throw new UserAdminError("User not found.");
  if (target.status === "ACTIVE") throw new UserAdminError("This user is already active.");
  const updated = await prisma.user.update({ where: { id: targetUserId }, data: { status: "ACTIVE" } });
  await recordAudit({ actorUserId: actor.id, action: "user.activated", entityType: "user", entityId: targetUserId, severity: "CRITICAL", before: { status: target.status }, after: { status: "ACTIVE" }, metadata: { email: target.email } });
  return updated;
}

/* ── Security helpers ──────────────────────────────────────────────────────── */

export async function sendPasswordResetForUser(targetUserId: string, actor: SessionUser) {
  const target = await prisma.user.findFirst({ where: { id: targetUserId, deletedAt: undefined } });
  if (!target) throw new UserAdminError("User not found.");
  if (target.status !== "ACTIVE") throw new UserAdminError("Password resets can only be sent to active users.");
  await requestPasswordReset(target.email);
  await recordAudit({ actorUserId: actor.id, action: "user.password_reset_sent", entityType: "user", entityId: targetUserId, severity: "NOTICE", metadata: { email: target.email } });
}

export async function signOutUserEverywhere(targetUserId: string, actor: SessionUser) {
  const target = await prisma.user.findFirst({ where: { id: targetUserId, deletedAt: undefined }, select: { id: true, email: true } });
  if (!target) throw new UserAdminError("User not found.");
  await invalidateAllUserSessions(targetUserId);
  await recordAudit({ actorUserId: actor.id, action: "user.sessions_revoked", entityType: "user", entityId: targetUserId, severity: "CRITICAL", metadata: { email: target.email, scope: "all" } });
}

export async function revokeUserSession(targetUserId: string, sessionId: string, actor: SessionUser) {
  const session = await prisma.session.findFirst({ where: { id: sessionId, userId: targetUserId } });
  if (!session) throw new UserAdminError("Session not found.");
  await invalidateSession(sessionId);
  await recordAudit({ actorUserId: actor.id, action: "user.session_revoked", entityType: "session", entityId: sessionId, severity: "NOTICE", metadata: { userId: targetUserId } });
}

/* ── Invitations ───────────────────────────────────────────────────────────── */

async function deliverInvite(user: { id: string; email: string; name: string }, platformRole: PlatformRole, invitedBy: SessionUser) {
  const url = await createInviteToken(user.email, { userId: user.id, platformRole, invitedByUserId: invitedBy.id });
  const platformName = env().PLATFORM_URL;
  await sendMail({
    to: user.email,
    subject: "You've been invited",
    text: `Hi ${user.name},\n\n${invitedBy.name} has invited you to ${platformName}.\nSet your password and accept the invitation here:\n${url}\n\nThe link expires in 7 days.`,
  });
}

export async function invitePlatformUser(input: { name: string; email: string; platformRole: PlatformRole }, actor: SessionUser) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!PLATFORM_ROLES.includes(input.platformRole)) throw new UserAdminError("Unknown platform role.");
  if (input.platformRole === "OWNER" && !hasPlatformRole(actor, "OWNER")) throw new UserAdminError("Only a platform OWNER can invite another OWNER.");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new UserAdminError("A user with this email already exists.");
  const user = await prisma.user.create({ data: { email, name, platformRole: input.platformRole, status: "INVITED" } });
  await deliverInvite(user, input.platformRole, actor);
  await recordAudit({ actorUserId: actor.id, action: "user.invited", entityType: "user", entityId: user.id, severity: input.platformRole === "NONE" ? "NOTICE" : "CRITICAL", after: { email, name, platformRole: input.platformRole, status: "INVITED" } });
  return user;
}

export async function resendInvite(targetUserId: string, actor: SessionUser) {
  const target = await prisma.user.findFirst({ where: { id: targetUserId, deletedAt: undefined } });
  if (!target) throw new UserAdminError("User not found.");
  if (target.status !== "INVITED") throw new UserAdminError("Only invited users can be re-invited.");
  await deliverInvite(target, target.platformRole, actor);
  await recordAudit({ actorUserId: actor.id, action: "user.invite_resent", entityType: "user", entityId: targetUserId, severity: "NOTICE", metadata: { email: target.email } });
}

/* ── Profile ───────────────────────────────────────────────────────────────── */

export async function updateUserProfile(targetUserId: string, input: { name: string; phone?: string | null; timezone?: string; locale?: string }, actor: SessionUser) {
  const target = await prisma.user.findFirst({ where: { id: targetUserId, deletedAt: undefined } });
  if (!target) throw new UserAdminError("User not found.");
  const data: Prisma.UserUpdateInput = { name: input.name.trim(), phone: input.phone?.trim() || null };
  if (input.timezone) data.timezone = input.timezone;
  if (input.locale) data.locale = input.locale;
  const updated = await prisma.user.update({ where: { id: targetUserId }, data });
  await recordAudit({ actorUserId: actor.id, action: "user.updated", entityType: "user", entityId: targetUserId, before: { name: target.name, phone: target.phone, timezone: target.timezone, locale: target.locale }, after: { name: updated.name, phone: updated.phone, timezone: updated.timezone, locale: updated.locale } });
  return updated;
}
