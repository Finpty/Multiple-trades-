import type { Prisma } from "@prisma/client";

/** Narrow a jsonb column to an expected shape with a fallback (never throws). */
export function asJson<T>(value: Prisma.JsonValue | null | undefined, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  return value as unknown as T;
}

export function asArray<T = unknown>(value: Prisma.JsonValue | null | undefined): T[] {
  return Array.isArray(value) ? (value as unknown as T[]) : [];
}

export function asObject<T extends object = Record<string, unknown>>(
  value: Prisma.JsonValue | null | undefined,
): T {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as unknown as T) : ({} as T);
}

/** Prisma rejects `undefined` inside Json; strip it recursively. */
export function toJson<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}
