"use client";

import * as React from "react";
import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import type { ActionResult } from "@/lib/actions";

export function LogoUploader({ businessId, current, action }: { businessId: string; current: PickedMedia | null; action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult> }) {
  const [value, setValue] = React.useState<string | null>(current?.id ?? null);
  return (
    <ActionForm action={action} className="flex flex-wrap items-end gap-4">
      <MediaPicker businessId={businessId} value={value} preview={current} onChange={(m) => setValue(m?.id ?? null)} name="logoMediaId" label="Upload logo" folderKey="logos" />
      <SubmitButton variant="secondary">Save logo</SubmitButton>
    </ActionForm>
  );
}
