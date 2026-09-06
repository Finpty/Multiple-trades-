import { prisma } from "@/lib/db";
import { sha256Hex } from "@/lib/crypto";

export class RateLimitError extends Error {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super("Too many attempts. Please try again later.");
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Fixed-window rate limiter backed by PostgreSQL so limits hold across all
 * application instances. Keys are hashed so raw emails/IPs are not stored.
 */
export async function enforceRateLimit(
  scope: string,
  identifier: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number },
): Promise<void> {
  const key = `${scope}:${sha256Hex(identifier.toLowerCase())}`;
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);

  const bucket = await prisma.rateLimitBucket.findUnique({ where: { key } });
  if (!bucket || bucket.resetAt <= now) {
    await prisma.rateLimitBucket.upsert({
      where: { key },
      create: { key, count: 1, resetAt },
      update: { count: 1, resetAt },
    });
    return;
  }
  if (bucket.count >= limit) {
    throw new RateLimitError(Math.max(1, Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000)));
  }
  await prisma.rateLimitBucket.update({ where: { key }, data: { count: { increment: 1 } } });
}

export async function purgeExpiredRateLimits(): Promise<number> {
  const r = await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } });
  return r.count;
}
