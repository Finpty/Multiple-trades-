"use client";

import * as React from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Select } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";

/** Role dropdown that submits on change. */
export function MemberRoleSelect({ action, fields, roleId, roles, disabled }: {
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
  fields: Record<string, string>;
  roleId: string;
  roles: Array<{ id: string; name: string }>;
  disabled?: boolean;
}) {
  return (
    <ActionForm action={action} className="inline-block min-w-[180px]">
      {({ pending }) => (
        <>
          {Object.entries(fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <Select name="roleId" defaultValue={roleId} disabled={disabled || pending} onChange={(e) => e.currentTarget.form?.requestSubmit()} aria-label="Role">
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </>
      )}
    </ActionForm>
  );
}
