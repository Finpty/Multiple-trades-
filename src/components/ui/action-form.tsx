"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/actions";
import { Alert } from "./index";

type FormAction<T> = (prev: ActionResult<T> | undefined, formData: FormData) => Promise<ActionResult<T>>;

/**
 * Client wrapper for server actions returning ActionResult. Shows errors,
 * optional success message, refreshes the route on success and can reset.
 */
export function ActionForm<T>({ action, children, className, onSuccess, successMessage, resetOnSuccess, refreshOnSuccess = true }: {
  action: FormAction<T>;
  children: React.ReactNode | ((state: { pending: boolean; result?: ActionResult<T>; fieldErrors: Record<string, string> }) => React.ReactNode);
  className?: string;
  onSuccess?: (data: T) => void;
  successMessage?: string;
  resetOnSuccess?: boolean;
  refreshOnSuccess?: boolean;
}) {
  const [result, formAction, pending] = useActionState<ActionResult<T> | undefined, FormData>(action, undefined);
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const handled = React.useRef<ActionResult<T> | undefined>(undefined);

  React.useEffect(() => {
    if (!result || handled.current === result) return;
    handled.current = result;
    if (result.ok) {
      onSuccess?.(result.data);
      if (resetOnSuccess) formRef.current?.reset();
      if (refreshOnSuccess) router.refresh();
    }
  }, [result, onSuccess, resetOnSuccess, refreshOnSuccess, router]);

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  return (
    <form ref={formRef} action={formAction} className={className}>
      {result && !result.ok && (
        <Alert tone="danger" className="mb-4">
          {result.error}
        </Alert>
      )}
      {result?.ok && (successMessage || result.message) && (
        <Alert tone="success" className="mb-4">
          {result.message ?? successMessage}
        </Alert>
      )}
      {typeof children === "function" ? children({ pending, result, fieldErrors }) : children}
    </form>
  );
}
