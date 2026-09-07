"use client";

import * as React from "react";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ActionResult } from "@/lib/actions";
import { FORM_FIELD_TYPES, type FormFieldDefinition, type FormFieldType, type FormSettings } from "@/lib/site/public-api";
import { FORM_ACTIONS, newFieldDefinition } from "@/lib/forms/builder";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Field, Input, Select, Switch, Textarea, cn } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form-status";
import { FieldEditor } from "./field-editor";
import { FormPreview } from "./form-preview";

export interface FormBuilderProps {
  businessId: string;
  form: { id: string; name: string; slug: string; description: string | null; action: string; isActive: boolean; archived: boolean };
  fields: FormFieldDefinition[];
  settings: FormSettings;
  services: Array<{ id: string; name: string }>;
  embeddedOnPages: number;
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? `f_${crypto.randomUUID().slice(0, 8)}` : `f_${Math.random().toString(36).slice(2, 10)}`;
}

export function FormBuilder({ form, fields: initialFields, settings, services, embeddedOnPages, action }: FormBuilderProps) {
  const [fields, setFields] = React.useState<FormFieldDefinition[]>(initialFields);
  const [selectedId, setSelectedId] = React.useState<string | null>(initialFields[0]?.id ?? null);
  const [tab, setTab] = React.useState<"fields" | "settings">("fields");
  const [meta, setMeta] = React.useState({ name: form.name, slug: form.slug, submitLabel: settings.submitLabel ?? "Send" });
  const [paletteType, setPaletteType] = React.useState<FormFieldType>("text");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const takenKeys = React.useMemo(() => new Set(fields.map((f) => f.key)), [fields]);
  const selected = fields.find((f) => f.id === selectedId) ?? null;

  function addField(type: FormFieldType) {
    const f = newFieldDefinition(type, newId(), takenKeys);
    setFields((prev) => [...prev, f]);
    setSelectedId(f.id);
    setTab("fields");
  }
  function updateField(next: FormFieldDefinition) {
    setFields((prev) => prev.map((f) => (f.id === next.id ? next : f)));
  }
  function removeField(id: string) {
    setFields((prev) => {
      const next = prev.filter((f) => f.id !== id);
      setSelectedId(next[0]?.id ?? null);
      return next;
    });
  }
  function duplicateField(id: string) {
    const src = fields.find((f) => f.id === id);
    if (!src) return;
    const copy: FormFieldDefinition = { ...src, id: newId(), key: `${src.key}_copy` };
    let n = 2;
    while (takenKeys.has(copy.key)) copy.key = `${src.key}_copy${n++}`;
    setFields((prev) => {
      const i = prev.findIndex((f) => f.id === id);
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
    });
    setSelectedId(copy.id);
  }
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setFields((prev) => arrayMove(prev, prev.findIndex((f) => f.id === active.id), prev.findIndex((f) => f.id === over.id)));
  }

  const previewSettings: FormSettings = { ...settings, submitLabel: meta.submitLabel };

  return (
    <ActionForm action={action} successMessage="Form saved">
      {({ fieldErrors }) => (
        <div className="space-y-4">
          <input type="hidden" name="fields:json" value={JSON.stringify(fields)} />
          {Object.keys(fieldErrors).length > 0 && (
            <Alert tone="danger" title="Please fix these before saving">
              <ul className="list-disc pl-4">
                {Object.entries(fieldErrors).map(([k, v]) => (
                  <li key={k}>
                    {k.startsWith("fields.") ? `Field ${Number(k.split(".")[1]) + 1}: ` : ""}
                    {v}
                  </li>
                ))}
              </ul>
            </Alert>
          )}
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-3">
            {(["fields", "settings"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={cn("rounded-md px-3 py-1.5 text-sm", tab === t ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100")}>
                {t === "fields" ? "Fields" : "Settings"}
              </button>
            ))}
            <span className="text-xs text-neutral-500">
              {fields.length} field{fields.length === 1 ? "" : "s"} · on {embeddedOnPages} page{embeddedOnPages === 1 ? "" : "s"}
            </span>
            <div className="ml-auto flex items-center gap-2">
              {form.archived && <Badge tone="neutral">Archived</Badge>}
              <SubmitButton pendingText="Saving…">Save form</SubmitButton>
            </div>
          </div>

          <div hidden={tab !== "fields"} className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <Card>
                <CardHeader title="Fields" description="Drag to reorder. Click a field to edit it." />
                <CardBody>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                      <ul className="space-y-1">
                        {fields.map((f) => (
                          <SortableFieldRow key={f.id} field={f} selected={f.id === selectedId} onSelect={() => setSelectedId(f.id)} />
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                  {fields.length === 0 && <p className="text-sm text-neutral-500">No fields yet — add one below.</p>}
                  <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-4">
                    <Field label="Add a field" className="min-w-[14rem] flex-1">
                      <Select value={paletteType} onChange={(e) => setPaletteType(e.target.value as FormFieldType)}>
                        {FORM_FIELD_TYPES.map((t) => (
                          <option key={t.type} value={t.type}>
                            {t.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Button type="button" variant="secondary" onClick={() => addField(paletteType)}>
                      Add field
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(["text", "email", "phone", "textarea", "service", "photo", "address", "date"] as FormFieldType[]).map((t) => (
                      <button key={t} type="button" onClick={() => addField(t)} className="rounded-full border border-neutral-200 px-2.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-100">
                        + {FORM_FIELD_TYPES.find((x) => x.type === t)?.label}
                      </button>
                    ))}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title={selected ? `Edit: ${selected.label || "Untitled"}` : "Field settings"} />
                <CardBody>
                  {selected ? <FieldEditor key={selected.id} field={selected} takenKeys={takenKeys} onChange={updateField} onRemove={() => removeField(selected.id)} onDuplicate={() => duplicateField(selected.id)} /> : <p className="text-sm text-neutral-500">Select a field to edit its label, key, options and validation.</p>}
                </CardBody>
              </Card>
            </div>
            <div className="lg:sticky lg:top-4 lg:self-start">
              <Card>
                <CardHeader title="Live preview" description="How the form will look on your website. Nothing is submitted from here." />
                <CardBody>
                  <FormPreview fields={fields} settings={previewSettings} services={services} highlightId={selectedId} onSelect={setSelectedId} />
                </CardBody>
              </Card>
            </div>
          </div>

          <div hidden={tab !== "settings"} className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Form" />
              <CardBody className="space-y-4">
                <Field label="Name" required error={fieldErrors.name}>
                  <Input name="name" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
                </Field>
                <Field label="Slug" required hint="Referenced by form blocks on your pages." error={fieldErrors.slug}>
                  <Input name="slug" value={meta.slug} onChange={(e) => setMeta({ ...meta, slug: e.target.value })} />
                </Field>
                <Field label="Description" hint="Internal note about where this form is used.">
                  <Textarea name="description" rows={2} defaultValue={form.description ?? ""} />
                </Field>
                <Field label="When submitted" error={fieldErrors.action}>
                  <Select name="action" defaultValue={form.action}>
                    {FORM_ACTIONS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label} — {a.description}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Switch name="isActive" checked={form.isActive} label="Active" description="Inactive forms are shown on the site as unavailable and reject submissions." />
                <Alert tone="info" title="Add to a page">
                  In the website editor add a <strong>Lead form</strong>, <strong>Quote form</strong> or <strong>Contact</strong> block and choose the form slug <code className="rounded bg-white px-1">{meta.slug}</code>. Currently on {embeddedOnPages} page{embeddedOnPages === 1 ? "" : "s"}.
                </Alert>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="After submission" />
              <CardBody className="space-y-4">
                <Field label="Submit button label">
                  <Input name="submitLabel" value={meta.submitLabel} onChange={(e) => setMeta({ ...meta, submitLabel: e.target.value })} />
                </Field>
                <Field label="Success message" error={fieldErrors.successMessage}>
                  <Textarea name="successMessage" rows={2} defaultValue={settings.successMessage ?? ""} />
                </Field>
                <Field label="Redirect URL (optional)" hint="Send people to a thank-you page instead of showing the message." error={fieldErrors.redirectUrl}>
                  <Input name="redirectUrl" defaultValue={settings.redirectUrl ?? ""} placeholder="/thank-you" />
                </Field>
                <Field label="Notify these emails" hint="Comma-separated. Defaults to the business email." error={fieldErrors.notifyEmails ?? fieldErrors["notifyEmails.0"]}>
                  <Input name="notifyEmails" defaultValue={(settings.notifyEmails ?? []).join(", ")} />
                </Field>
                <Field label="Auto-reply subject" hint="Placeholders: {{name}}, {{business}}, {{service}}">
                  <Input name="autoReplySubject" defaultValue={settings.autoReplySubject ?? ""} />
                </Field>
                <Field label="Auto-reply body" hint="Leave empty to send no auto-reply.">
                  <Textarea name="autoReplyBody" rows={5} defaultValue={settings.autoReplyBody ?? ""} placeholder={"Hi {{name}},\n\nThanks for getting in touch with {{business}}. We will be in touch shortly."} />
                </Field>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </ActionForm>
  );
}

function SortableFieldRow({ field, selected, onSelect }: { field: FormFieldDefinition; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const typeLabel = FORM_FIELD_TYPES.find((t) => t.type === field.type)?.label ?? field.type;
  return (
    <li ref={setNodeRef} style={style} className={cn("flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm", selected ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 bg-white", isDragging && "opacity-60 shadow-lg")}>
      <button type="button" className="cursor-grab touch-none text-neutral-400 hover:text-neutral-700" aria-label="Drag to reorder" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className="truncate font-medium text-neutral-900">{field.label || "Untitled"}</span>
        <span className="truncate text-xs text-neutral-500">{field.key}</span>
        <span className="ml-auto shrink-0 text-xs text-neutral-400">{typeLabel}</span>
        {field.required && <span className="text-xs text-red-600">*</span>}
      </button>
    </li>
  );
}
