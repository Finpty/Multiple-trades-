"use client";

import { useRouter } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { Field, Input, Select } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";

type Action<T = undefined> = (prev: ActionResult<T> | undefined, formData: FormData) => Promise<ActionResult<T>>;

const ROLE_HELP: Record<string, string> = {
  NONE: "Ordinary user: access only through business or organisation memberships.",
  SUPPORT: "Read-only platform support access (no Super Admin).",
  ADMIN: "Full Super Admin access to every business.",
  OWNER: "Platform owner: everything, including granting OWNER to others.",
};

export function InviteUserForm({ action, roles, canGrantOwner }: { action: Action<{ userId: string }>; roles: string[]; canGrantOwner: boolean }) {
  const router = useRouter();
  return (
    <ActionForm action={action} refreshOnSuccess={false} onSuccess={(data) => router.push(`/super-admin/users/${data.userId}`)}>
      {({ fieldErrors, pending }) => (
        <fieldset disabled={pending} className="space-y-4">
          <Field label="Full name" required error={fieldErrors.name} htmlFor="invite-name">
            <Input id="invite-name" name="name" required maxLength={120} autoComplete="off" />
          </Field>
          <Field label="Email" required error={fieldErrors.email} htmlFor="invite-email">
            <Input id="invite-email" name="email" type="email" required autoComplete="off" placeholder="person@example.com" />
          </Field>
          <Field label="Platform role" required error={fieldErrors.platformRole} htmlFor="invite-role" hint={canGrantOwner ? undefined : "Only a platform OWNER can invite another OWNER."}>
            <Select id="invite-role" name="platformRole" defaultValue="NONE" required>
              {roles.map((r) => (
                <option key={r} value={r} disabled={r === "OWNER" && !canGrantOwner}>
                  {r} — {ROLE_HELP[r] ?? ""}
                </option>
              ))}
            </Select>
          </Field>
          <SubmitButton pendingText="Sending…">Send invitation</SubmitButton>
        </fieldset>
      )}
    </ActionForm>
  );
}

export function UserProfileForm({ action, user }: { action: Action; user: { id: string; name: string; phone: string | null; timezone: string; locale: string } }) {
  return (
    <ActionForm action={action}>
      {({ fieldErrors, pending }) => (
        <fieldset disabled={pending} className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="userId" value={user.id} />
          <Field label="Full name" required error={fieldErrors.name}>
            <Input name="name" defaultValue={user.name} required maxLength={120} />
          </Field>
          <Field label="Phone" error={fieldErrors.phone}>
            <Input name="phone" defaultValue={user.phone ?? ""} maxLength={40} />
          </Field>
          <Field label="Timezone" error={fieldErrors.timezone}>
            <Input name="timezone" defaultValue={user.timezone} maxLength={80} />
          </Field>
          <Field label="Locale" error={fieldErrors.locale}>
            <Input name="locale" defaultValue={user.locale} maxLength={20} />
          </Field>
          <div className="md:col-span-2">
            <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
          </div>
        </fieldset>
      )}
    </ActionForm>
  );
}

export function PlatformRoleForm({ action, userId, currentRole, roles, canGrantOwner, disabled, disabledReason }: {
  action: Action;
  userId: string;
  currentRole: string;
  roles: string[];
  canGrantOwner: boolean;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <ActionForm action={action}>
      {({ fieldErrors, pending }) => (
        <fieldset disabled={disabled || pending} className="space-y-3">
          <input type="hidden" name="userId" value={userId} />
          <Field label="Platform role" error={fieldErrors.platformRole} hint={disabledReason ?? (canGrantOwner ? "Changes take effect on the user's next request." : "Only a platform OWNER can grant or revoke OWNER.")}>
            <Select name="platformRole" defaultValue={currentRole}>
              {roles.map((r) => (
                <option key={r} value={r} disabled={(r === "OWNER" || currentRole === "OWNER") && !canGrantOwner && r !== currentRole}>
                  {r} — {ROLE_HELP[r] ?? ""}
                </option>
              ))}
            </Select>
          </Field>
          <SubmitButton variant="secondary" pendingText="Updating…">
            Update role
          </SubmitButton>
        </fieldset>
      )}
    </ActionForm>
  );
}
