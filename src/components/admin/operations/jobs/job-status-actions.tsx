"use client";

import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { ConfirmButton } from "@/components/ui/confirm-button";
import type { ActionResult } from "@/lib/actions";

type FormAction = (prev: ActionResult | undefined, fd: FormData) => Promise<ActionResult>;

/** Complete / cancel / archive / reopen buttons for the job header. */
export function JobStatusActions({ businessId, jobId, status, archived, completeAction, statusAction }: {
  businessId: string;
  jobId: string;
  status: string;
  archived: boolean;
  completeAction: FormAction;
  statusAction: FormAction;
}) {
  const hidden = (
    <>
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="jobId" value={jobId} />
    </>
  );
  if (archived) {
    return (
      <ActionForm action={statusAction}>
        {hidden}
        <input type="hidden" name="status" value="RESTORE" />
        <SubmitButton variant="secondary" pendingText="Restoring…">Restore job</SubmitButton>
      </ActionForm>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "OPEN" && (
        <ActionForm action={completeAction}>
          {hidden}
          <SubmitButton pendingText="Completing…">Mark complete</SubmitButton>
        </ActionForm>
      )}
      {status === "OPEN" && (
        <ActionForm action={statusAction}>
          {hidden}
          <input type="hidden" name="status" value="CANCELED" />
          <ConfirmButton variant="secondary" confirm="Cancel this job? It stays in the list as canceled.">Cancel job</ConfirmButton>
        </ActionForm>
      )}
      {(status === "COMPLETED" || status === "CANCELED") && (
        <ActionForm action={statusAction}>
          {hidden}
          <input type="hidden" name="status" value="OPEN" />
          <SubmitButton variant="secondary" pendingText="Reopening…">Reopen</SubmitButton>
        </ActionForm>
      )}
      <ActionForm action={statusAction}>
        {hidden}
        <input type="hidden" name="status" value="ARCHIVED" />
        <ConfirmButton variant="ghost" confirm="Archive this job? It will be hidden from the board and lists but can be restored.">Archive</ConfirmButton>
      </ActionForm>
    </div>
  );
}
