"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, Checkbox, Field, Input, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker";
import { CheckboxTree, type CheckboxTreeItem } from "@/components/admin/content/services/checkbox-tree";
import { saveMaterialAction } from "@/app/admin/[businessId]/materials/actions";

export interface MaterialFormValues { name: string; slug: string; category: string; description: string; mediaId: string | null; attributes: Array<{ key: string; value: string }>; isActive: boolean; serviceIds: string[] }

export function MaterialForm({ businessId, materialId, values, photo, services, categories }: { businessId: string; materialId: string | null; values: MaterialFormValues; photo: PickedMedia | null; services: CheckboxTreeItem[]; categories: string[] }) {
  const router = useRouter();
  const [mediaId, setMediaId] = React.useState(values.mediaId);
  const [attrs, setAttrs] = React.useState(values.attributes);
  const [selected, setSelected] = React.useState(new Set(values.serviceIds));
  const onSuccess = React.useCallback((d: { id: string; created: boolean }) => { if (d.created) router.push(`/admin/${businessId}/materials/${d.id}`); }, [router, businessId]);
  return (
    <ActionForm action={saveMaterialAction} onSuccess={onSuccess}>
      {({ fieldErrors }) => (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <input type="hidden" name="businessId" value={businessId} />
          {materialId && <input type="hidden" name="materialId" value={materialId} />}
          <input type="hidden" name="attributes:json" value={JSON.stringify(attrs.filter((a) => a.key.trim()))} />
          <div className="space-y-4">
            <Card><CardBody className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Name" required error={fieldErrors.name}><Input name="name" defaultValue={values.name} required /></Field>
                <Field label="URL slug" hint="Leave blank to generate" error={fieldErrors.slug}><Input name="slug" defaultValue={values.slug} /></Field>
                <Field label="Category" hint="e.g. Porcelain, Natural stone, Fixtures" error={fieldErrors.category}><Input name="category" list="material-categories" defaultValue={values.category} /><datalist id="material-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist></Field>
                <div className="pt-6"><Checkbox name="isActive" defaultChecked={values.isActive} label="Active (selectable on services and projects)" /></div>
              </div>
              <Field label="Description" error={fieldErrors.description}><Textarea name="description" rows={4} defaultValue={values.description} /></Field>
            </CardBody></Card>
            <Card><CardHeader title="Attributes" description="Specifications shown on the website, e.g. Size = 600×600, Finish = Matt, Slip rating = P4." /><CardBody className="space-y-2">
              {attrs.map((a, i) => (
                <div key={i} className="grid grid-cols-[180px_1fr_auto] gap-2">
                  <Input value={a.key} placeholder="Attribute" onChange={(e) => setAttrs(attrs.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
                  <Input value={a.value} placeholder="Value" onChange={(e) => setAttrs(attrs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAttrs(attrs.filter((_, j) => j !== i))}>✕</Button>
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={() => setAttrs([...attrs, { key: "", value: "" }])}>+ Add attribute</Button>
              {fieldErrors.attributes && <p className="text-xs text-red-600">{fieldErrors.attributes}</p>}
            </CardBody></Card>
            <div><SubmitButton>{materialId ? "Save changes" : "Add material"}</SubmitButton></div>
          </div>
          <div className="space-y-4">
            <Card><CardHeader title="Image" /><CardBody><MediaPicker businessId={businessId} name="mediaId" value={mediaId} preview={photo} onChange={(m) => setMediaId(m?.id ?? null)} folderKey="materials" /></CardBody></Card>
            <Card><CardHeader title="Used by services" description="Listed on those service pages." /><CardBody><CheckboxTree name="serviceIds" items={services} selected={selected} onChange={setSelected} /></CardBody></Card>
          </div>
        </div>
      )}
    </ActionForm>
  );
}
