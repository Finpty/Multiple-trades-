"use client";

import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { ConfirmButton } from "@/components/ui/confirm-button";
import type { ActionResult } from "@/lib/actions";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";

/**
 * One-click server action as a button: renders a form with hidden fields and
 * either a plain submit or a confirmed submit. Errors show inline.
 */
export function ActionButton({ action, fields, confirm, children, variant = "secondary", size = "sm", pendingText, className, successMessage }: {
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
  fields?: Record<string, string>;
  confirm?: string;
  children: React.ReactNode;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  pendingText?: string;
  className?: string;
  successMessage?: string;
}) {
  return (
    <ActionForm action={action} className={className ?? "inline-block"} successMessage={successMessage}>
      {fields && Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {confirm ? (
        <ConfirmButton confirm={confirm} variant={variant} size={size}>
          {children}
        </ConfirmButton>
      ) : (
        <SubmitButton variant={variant} size={size} pendingText={pendingText ?? "Working…"}>
          {children}
        </SubmitButton>
      )}
    </ActionForm>
  );
}
