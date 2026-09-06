import { ZodError } from "zod";
import { AuthorizationError } from "@/lib/authz";
import { RateLimitError } from "@/lib/auth/rate-limit";
import { AuthError } from "@/lib/auth/service";

/**
 * Uniform result shape for server actions consumed by client forms.
 * Actions return `{ ok: true, data }` or `{ ok: false, error, fieldErrors }`.
 * Redirects (from next/navigation) are re-thrown untouched.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

function isRedirectError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}

/** Wraps an action body, translating known errors into ActionResult. */
export async function runAction<T>(fn: () => Promise<ActionResult<T> | T>): Promise<ActionResult<T>> {
  try {
    const result = await fn();
    if (result && typeof result === "object" && "ok" in (result as object)) return result as ActionResult<T>;
    return ok(result as T);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) fieldErrors[issue.path.join(".") || "_"] = issue.message;
      return fail("Please correct the highlighted fields.", fieldErrors);
    }
    if (error instanceof AuthorizationError || error instanceof AuthError || error instanceof RateLimitError) return fail(error.message);
    if (error instanceof Error && error.name.endsWith("Error") && error.message.length < 300 && !/prisma|invocation/i.test(error.message)) return fail(error.message);
    console.error("[action] unexpected error", error);
    return fail("Something went wrong. Please try again.");
  }
}

/** FormData → plain object with support for `a.b` keys, arrays (`key[]`) and JSON fields (`key:json`). */
export function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of formData.entries()) {
    if (rawKey.startsWith("$ACTION")) continue;
    let key = rawKey;
    let val: unknown = value;
    if (key.endsWith(":json")) {
      key = key.slice(0, -5);
      try {
        val = typeof value === "string" && value !== "" ? JSON.parse(value) : null;
      } catch {
        val = null;
      }
    }
    if (key.endsWith("[]")) {
      key = key.slice(0, -2);
      const list = (out[key] as unknown[]) ?? [];
      list.push(val);
      out[key] = list;
      continue;
    }
    out[key] = val;
  }
  return out;
}

export const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
export const optStr = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);
export const num = (v: unknown): number | undefined => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};
export const bool = (v: unknown): boolean => v === true || v === "true" || v === "on" || v === "1";
