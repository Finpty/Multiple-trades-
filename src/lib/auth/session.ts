import { cookies, headers } from "next/headers";
import { cache } from "react";
import type { Session, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { isProduction } from "@/lib/env";

export const SESSION_COOKIE = "to_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_REFRESH_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000; // extend when < 15 days remain

export type SessionUser = Omit<User, "passwordHash" | "mfaSecretEncrypted">;
export type SessionResult = { session: Session; user: SessionUser } | { session: null; user: null };

function stripSensitive(user: User): SessionUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, mfaSecretEncrypted, ...safe } = user;
  return safe;
}

export async function createSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ token: string; session: Session }> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { sessionVersion: true } });
  const token = randomToken(32);
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256Hex(token),
      sessionVersion: user.sessionVersion,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 512) ?? null,
    },
  });
  return { token, session };
}

export async function validateSessionToken(token: string): Promise<SessionResult> {
  if (!token || token.length < 20) return { session: null, user: null };
  const tokenHash = sha256Hex(token);
  const session = await prisma.session.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!session || session.revokedAt) return { session: null, user: null };
  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return { session: null, user: null };
  }
  const { user } = session;
  if (user.status !== "ACTIVE" || user.deletedAt || user.sessionVersion !== session.sessionVersion) {
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } }).catch(() => undefined);
    return { session: null, user: null };
  }
  if (session.expiresAt.getTime() - now < SESSION_REFRESH_THRESHOLD_MS) {
    const expiresAt = new Date(now + SESSION_TTL_MS);
    await prisma.session.update({ where: { id: session.id }, data: { expiresAt, lastActiveAt: new Date() } });
    session.expiresAt = expiresAt;
  }
  return { session, user: stripSensitive(user) };
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/** Sign the user out everywhere: bumps sessionVersion so every existing session is rejected. */
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } }),
    prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: isProduction(), path: "/", maxAge: 0 });
}

/** Current session for this request, memoised per request. */
export const getCurrentSession = cache(async (): Promise<SessionResult> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return { session: null, user: null };
  return validateSessionToken(token);
});

export async function getCurrentUser(): Promise<SessionUser | null> {
  const { user } = await getCurrentSession();
  return user;
}

export async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() ?? null : h.get("x-real-ip");
  return { ip: ip ?? null, userAgent: h.get("user-agent") };
}

export async function purgeExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: new Date(Date.now() - 7 * 86_400_000) } }] },
  });
  return result.count;
}
