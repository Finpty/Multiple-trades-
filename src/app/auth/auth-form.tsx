"use client";

import { useActionState } from "react";
import type { AuthFormState } from "./actions";

type Field = { name: string; label: string; type?: string; autoComplete?: string; required?: boolean; minLength?: number };

export function AuthForm({ action, fields, submitLabel, pendingLabel, hidden = {}, footer }: {
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  fields: Field[];
  submitLabel: string;
  pendingLabel?: string;
  hidden?: Record<string, string>;
  footer?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {state?.success ? (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.success}</p>
      ) : (
        fields.map((f) => (
          <label key={f.name} className="block text-sm">
            <span className="mb-1 block font-medium">{f.label}</span>
            <input name={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} required={f.required ?? true} minLength={f.minLength} className="w-full rounded-md border px-3 py-2" />
          </label>
        ))
      )}
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {!state?.success && (
        <button type="submit" disabled={pending} className="w-full rounded-md bg-neutral-900 px-4 py-2 text-white disabled:opacity-60">
          {pending ? pendingLabel ?? "Please wait…" : submitLabel}
        </button>
      )}
      {footer && <div className="text-center text-xs text-neutral-500">{footer}</div>}
    </form>
  );
}
