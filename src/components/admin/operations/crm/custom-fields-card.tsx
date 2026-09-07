"use client";

import type { ActionResult } from "@/lib/actions";
import type { FieldDefinitionView } from "@/lib/custom-fields";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { CustomFieldsForm } from "@/components/admin/custom-fields-form";

/** Inline editor for an entity's custom field values, saved by the given action. */
export function CustomFieldsCard({ businessId, action, definitions, values }: { businessId: string; action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>; definitions: FieldDefinitionView[]; values: Record<string, unknown> }) {
  return (
    <ActionForm action={action} successMessage="Details saved">
      {({ fieldErrors }) => (
        <div className="space-y-3">
          <CustomFieldsForm definitions={definitions} values={values} businessId={businessId} errors={fieldErrors} />
          <div className="flex justify-end">
            <SubmitButton size="sm" pendingText="Saving…">
              Save details
            </SubmitButton>
          </div>
        </div>
      )}
    </ActionForm>
  );
}
