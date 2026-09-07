"use client";

import * as React from "react";
import type { FormFieldDefinition } from "@/lib/site/public-api";
import { FORM_FIELD_TYPES } from "@/lib/site/public-api";
import { FIELD_TYPES_WITH_FILES, FIELD_TYPES_WITH_OPTIONS, FIELD_TYPES_WITH_RANGE, snakeKey, uniqueKey } from "@/lib/forms/builder";
import { Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";

const ACCEPT_HINT: Record<string, string> = { photo: "Images (jpg, png, heic, webp)", video: "Video (mp4, mov, webm)", file: "Documents, images and PDFs" };

/** Edits one field definition. Emits the whole updated field on every change. */
export function FieldEditor({ field, takenKeys, onChange, onRemove, onDuplicate }: { field: FormFieldDefinition; takenKeys: Set<string>; onChange: (next: FormFieldDefinition) => void; onRemove: () => void; onDuplicate: () => void }) {
  const [keyTouched, setKeyTouched] = React.useState(false);
  const typeLabel = FORM_FIELD_TYPES.find((t) => t.type === field.type)?.label ?? field.type;
  const set = (patch: Partial<FormFieldDefinition>) => onChange({ ...field, ...patch });
  const others = new Set(Array.from(takenKeys).filter((k) => k !== field.key));

  const options = field.options ?? [];
  const setOption = (i: number, patch: Partial<{ value: string; label: string }>) => set({ options: options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{typeLabel}</div>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onDuplicate}>
            Duplicate
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>
      <Field label="Label" required>
        <Input
          value={field.label}
          onChange={(e) => {
            const label = e.target.value;
            set(keyTouched ? { label } : { label, key: uniqueKey(snakeKey(label || "field"), others) });
          }}
        />
      </Field>
      <Field label="Key" hint="Used in submission data and automations. Lowercase, unique." error={others.has(field.key) ? "This key is already used by another field." : undefined}>
        <Input
          value={field.key}
          onChange={(e) => {
            setKeyTouched(true);
            set({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") });
          }}
        />
      </Field>
      {field.type !== "hidden" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Width">
            <Select value={field.width ?? "full"} onChange={(e) => set({ width: e.target.value as "full" | "half" })}>
              <option value="full">Full width</option>
              <option value="half">Half width</option>
            </Select>
          </Field>
          <div className="pt-6">
            <Checkbox label="Required" checked={!!field.required} onChange={(e) => set({ required: e.target.checked })} />
          </div>
        </div>
      )}
      {!["checkbox", "radio", "signature", "hidden", "file", "photo", "video"].includes(field.type) && (
        <Field label="Placeholder">
          <Input value={field.placeholder ?? ""} onChange={(e) => set({ placeholder: e.target.value || undefined })} />
        </Field>
      )}
      {field.type !== "hidden" && (
        <Field label="Help text">
          <Textarea rows={2} value={field.helpText ?? ""} onChange={(e) => set({ helpText: e.target.value || undefined })} />
        </Field>
      )}
      {FIELD_TYPES_WITH_OPTIONS.includes(field.type) && (
        <Field label="Options" hint="Value is stored; label is shown.">
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="value" value={o.value} onChange={(e) => setOption(i, { value: e.target.value })} className="w-1/3" />
                <Input placeholder="Label" value={o.label} onChange={(e) => setOption(i, { label: e.target.value, ...(o.value === snakeKey(o.label) || !o.value ? { value: snakeKey(e.target.value) } : {}) })} />
                <Button type="button" variant="ghost" size="sm" onClick={() => set({ options: options.filter((_, idx) => idx !== i) })} aria-label="Remove option">
                  ×
                </Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={() => set({ options: [...options, { value: `option_${options.length + 1}`, label: `Option ${options.length + 1}` }] })}>
              Add option
            </Button>
          </div>
        </Field>
      )}
      {FIELD_TYPES_WITH_RANGE.includes(field.type) && (
        <div className="grid grid-cols-3 gap-3">
          <Field label="Unit">
            <Input value={field.unit ?? ""} onChange={(e) => set({ unit: e.target.value || undefined })} placeholder="m²" />
          </Field>
          <Field label="Min">
            <Input type="number" value={field.min ?? ""} onChange={(e) => set({ min: e.target.value === "" ? undefined : Number(e.target.value) })} />
          </Field>
          <Field label="Max">
            <Input type="number" value={field.max ?? ""} onChange={(e) => set({ max: e.target.value === "" ? undefined : Number(e.target.value) })} />
          </Field>
        </div>
      )}
      {FIELD_TYPES_WITH_FILES.includes(field.type) && (
        <Field label="Maximum files" hint={ACCEPT_HINT[field.type]}>
          <Input type="number" min={1} max={20} value={field.maxFiles ?? 1} onChange={(e) => set({ maxFiles: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} />
        </Field>
      )}
      {field.type === "hidden" && (
        <Field label="Value" hint="Stored with every submission (e.g. a campaign name).">
          <Input value={field.defaultValue ?? ""} onChange={(e) => set({ defaultValue: e.target.value })} />
        </Field>
      )}
    </div>
  );
}
