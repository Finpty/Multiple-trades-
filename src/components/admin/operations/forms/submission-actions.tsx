"use client";

import { Button } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { createLeadFromSubmission, deleteSubmission, setSubmissionStatus } from "@/app/admin/[businessId]/forms/actions";

/** Status, lead creation and delete controls for one submission. */
export function SubmissionActions({ businessId, submissionId, status, hasLead, canManageCrm }: { businessId: string; submissionId: string; status: string; hasLead: boolean; canManageCrm: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActionForm action={setSubmissionStatus.bind(null, businessId)} className="inline">
        <input type="hidden" name="submissionId" value={submissionId} />
        <input type="hidden" name="status" value={status === "SPAM" ? "NEW" : "SPAM"} />
        <Button type="submit" variant="secondary" size="sm">
          {status === "SPAM" ? "Not spam" : "Mark as spam"}
        </Button>
      </ActionForm>
      {status === "NEW" && (
        <ActionForm action={setSubmissionStatus.bind(null, businessId)} className="inline">
          <input type="hidden" name="submissionId" value={submissionId} />
          <input type="hidden" name="status" value="PROCESSED" />
          <Button type="submit" variant="secondary" size="sm">
            Mark processed
          </Button>
        </ActionForm>
      )}
      {!hasLead && canManageCrm && status !== "SPAM" && (
        <ActionForm action={createLeadFromSubmission.bind(null, businessId)} className="inline" refreshOnSuccess={false}>
          <input type="hidden" name="submissionId" value={submissionId} />
          <Button type="submit" size="sm">
            Create lead from submission
          </Button>
        </ActionForm>
      )}
      <ActionForm action={deleteSubmission.bind(null, businessId)} className="inline" refreshOnSuccess={false}>
        <input type="hidden" name="submissionId" value={submissionId} />
        <ConfirmButton confirm="Delete this submission permanently? Any lead created from it is kept." variant="danger" size="sm">
          Delete
        </ConfirmButton>
      </ActionForm>
    </div>
  );
}
