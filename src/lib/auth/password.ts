import { hash, verify } from "@node-rs/argon2";

/** @node-rs/argon2 Algorithm.Argon2id (const enum; inlined because isolatedModules forbids ambient const enums). */
const ARGON2ID = 2;

/**
 * Argon2id with OWASP-recommended parameters (19 MiB memory, 2 iterations,
 * parallelism 1). Hashes are self-describing, so parameters can be raised
 * later and old hashes still verify; `needsRehash` flags them for upgrade.
 */
const PARAMS = { algorithm: ARGON2ID, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, PARAMS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password, PARAMS);
  } catch {
    return false;
  }
}

export function needsRehash(passwordHash: string): boolean {
  return !passwordHash.startsWith("$argon2id$") || !passwordHash.includes(`m=${PARAMS.memoryCost},t=${PARAMS.timeCost}`);
}

export const PASSWORD_MIN_LENGTH = 10;

export function validatePasswordStrength(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > 256) return "Password is too long.";
  if (/^(.)\1+$/.test(password)) return "Password is too repetitive.";
  return null;
}
