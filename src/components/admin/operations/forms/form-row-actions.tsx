"use client";

import Link from "next/link";
import { Button, buttonClass } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { archiveForm, duplicateForm, toggleFormActive } from "@/app/admin/[businessId]/forms/actions";

/** Per-row actions on the forms list: activate/deactivate, duplicate, archive/restore. */
export function FormRowActions({ businessId, formId, isActive, archived }: { businessId: string; formId: string; isActive: boolean; archived: boolean }) {
  const base = `/admin/${businessId}/forms/${formId}`;
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Link href={base} className={buttonClass("secondary", "sm")}>
        Edit
      </Link>
      {!archived && (
        <ActionForm action={toggleFormActive.bind(null, businessId)} className="inline">
          <input type="hidden" name="formId" value={formId} />
          <Button type="submit" variant="ghost" size="sm">
            {isActive ? "Deactivate" : "Activate"}
          </Button>
        </ActionForm>
      )}
      <ActionForm action={duplicateForm.bind(null, businessId)} className="inline" refreshOnSuccess={false}>
        <input type="hidden" name="formId" value={formId} />
        <Button type="submit" variant="ghost" size="sm">
          Duplicate
        </Button>
      </ActionForm>
      <ActionForm action={archiveForm.bind(null, businessId)} className="inline">
        <input type="hidden" name="formId" value={formId} />
        {archived ? (
          <>
            <input type="hidden" name="restore" value="true" />
            <Button type="submit" variant="ghost" size="sm">
              Restore
            </Button>
          </>
        ) : (
          <ConfirmButton confirm="Archive this form? It will stop accepting submissions until restored." variant="ghost" size="sm">
            Archive
          </ConfirmButton>
        )}
      </ActionForm>
    </div>
  );
}
