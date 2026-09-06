"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Email</span>
        <input name="email" type="email" autoComplete="email" required className="w-full rounded-md border px-3 py-2" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className="w-full rounded-md border px-3 py-2" />
      </label>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-md bg-neutral-900 px-4 py-2 text-white disabled:opacity-60">
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-xs text-neutral-500">
        <a href="/auth/forgot" className="underline">Forgot your password?</a>
      </p>
    </form>
  );
}
