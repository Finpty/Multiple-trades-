"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, loginWithPassword } from "@/lib/auth/service";
import { RateLimitError } from "@/lib/auth/rate-limit";
import { hasPlatformRole } from "@/lib/authz";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export type LoginState = { error?: string } | undefined;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid email and password." };
  let destination = "/admin";
  try {
    const user = await loginWithPassword(parsed.data);
    const next = parsed.data.next;
    if (next && next.startsWith("/") && !next.startsWith("//")) destination = next;
    else if (hasPlatformRole(user, "ADMIN")) destination = "/super-admin";
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message };
    if (error instanceof RateLimitError) return { error: error.message };
    throw error;
  }
  redirect(destination);
}
