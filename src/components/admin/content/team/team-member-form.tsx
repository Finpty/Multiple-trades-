"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, Checkbox, Field, Input, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker";
import { saveTeamMemberAction } from "@/app/admin/[businessId]/team/actions";

export interface TeamMemberFormValues { name: string; role: string; bio: string; email: string; phone: string; mediaId: string | null; isActive: boolean }

export function TeamMemberForm({ businessId, memberId, values, photo }: { businessId: string; memberId: string | null; values: TeamMemberFormValues; photo: PickedMedia | null }) {
  const router = useRouter();
  const [mediaId, setMediaId] = React.useState(values.mediaId);
  const onSuccess = React.useCallback((d: { id: string; created: boolean }) => { if (d.created) router.push(`/admin/${businessId}/team/${d.id}`); }, [router, businessId]);
  return (
    <ActionForm action={saveTeamMemberAction} onSuccess={onSuccess}>
      {({ fieldErrors }) => (
        <Card className="max-w-3xl"><CardBody className="space-y-4">
          <input type="hidden" name="businessId" value={businessId} />
          {memberId && <input type="hidden" name="memberId" value={memberId} />}
          <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
            <Field label="Name" required error={fieldErrors.name}><Input name="name" defaultValue={values.name} required /></Field>
            <Field label="Role / title" hint="e.g. Owner & lead tiler" error={fieldErrors.role}><Input name="role" defaultValue={values.role} /></Field>
            <Field label="Email" hint="Optional. Shown on the website if filled in." error={fieldErrors.email}><Input name="email" type="email" defaultValue={values.email} /></Field>
            <Field label="Phone" error={fieldErrors.phone}><Input name="phone" defaultValue={values.phone} /></Field>
          </div>
          <Field label="Bio" error={fieldErrors.bio}><Textarea name="bio" rows={4} defaultValue={values.bio} /></Field>
          <Field label="Photo"><MediaPicker businessId={businessId} name="mediaId" value={mediaId} preview={photo} onChange={(m) => setMediaId(m?.id ?? null)} folderKey="team" /></Field>
          <Checkbox name="isActive" defaultChecked={values.isActive} label="Show on the website" />
          <div><SubmitButton>{memberId ? "Save changes" : "Add team member"}</SubmitButton></div>
        </CardBody></Card>
      )}
    </ActionForm>
  );
}
