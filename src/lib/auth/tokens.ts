import type { AuthTokenType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { randomToken, sha256Hex } from "@/lib/crypto";

const DEFAULT_TTL: Record<AuthTokenType, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
  INVITE: 7 * 24 * 60 * 60 * 1000,
  MAGIC_LINK: 15 * 60 * 1000,
};

/** Creates a single-use token. Only its SHA-256 hash is stored. */
export async function createAuthToken(input: {
  type: AuthTokenType;
  email: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
  ttlMs?: number;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? DEFAULT_TTL[input.type]));
  // Invalidate earlier unused tokens of the same type for this email.
  await prisma.authToken.updateMany({
    where: { email: input.email.toLowerCase(), type: input.type, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.authToken.create({
    data: {
      type: input.type,
      email: input.email.toLowerCase(),
      userId: input.userId ?? null,
      tokenHash: sha256Hex(token),
      expiresAt,
      metadata: (input.metadata ?? {}) as object,
    },
  });
  return { token, expiresAt };
}

/** Atomically consumes a token. Returns null when missing, expired or already used. */
export async function consumeAuthToken(type: AuthTokenType, token: string) {
  if (!token) return null;
  const now = new Date();
  const record = await prisma.authToken.findUnique({ where: { tokenHash: sha256Hex(token) } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt <= now) return null;
  const updated = await prisma.authToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: now } });
  if (updated.count !== 1) return null;
  return record;
}
