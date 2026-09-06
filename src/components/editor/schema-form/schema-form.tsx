"use client";

import * as React from "react";
import { z, type ZodTypeAny } from "zod";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button, Checkbox, Field, Input, Select, Textarea, cn, inputClass } from "@/components/ui";
import { MediaPicker } from "@/components/admin/media-picker";
import type { EditorOptionItem, EditorOptions } from "@/lib/website/options";
import { SortableRows } from "./sortable-rows";
import { MONOSPACE_KEY_RE, TEXTAREA_KEY_RE, emptyValueFor, enumValues, fieldKind, isRequired, labelFromKey, numberConstraints, referenceKind, stringMaxLength, unwrap, type ReferenceKind } from "./introspect";

/**
 * SchemaForm: renders inputs for any zod v3 object schema at runtime. Values
 * are plain JSON (the same shape zod validates), so the form works for block
 * props, section settings, theme tokens and any future schema without
 * per-schema UI code. Reference fields (serviceId, formSlug, …) and the
 * MediaRef / Link shapes get specialised inputs.
 */
export interface SchemaFormProps {
  schema: z.ZodObject<z.ZodRawShape>;
  value: Record<string, unknown> | undefined;
  onChange: (next: Record<string, unknown>) => void;
  businessId: string;
  options?: EditorOptions;
  /** Field errors keyed by dotted path ("items.0.title"). */
  errors?: Record<string, string>;
  /** Dotted path prefix of this (nested) form; used for error lookup and input ids. */
  path?: string;
  /** Keys to hide (e.g. handled elsewhere). */
  omit?: string[];
  /** Keys to render first, in this order. */
  order?: string[];
  disabled?: boolean;
  className?: string;
}

const EMPTY_OPTIONS: EditorOptions = { pages: [], services: [], projects: [], teamMembers: [], forms: [] };

function joinPath(prefix: string | undefined, key: string | number): string {
  return prefix ? `${prefix}.${key}` : String(key);
}

export function SchemaForm({ schema, value, onChange, businessId, options = EMPTY_OPTIONS, errors = {}, path, omit = [], order = [], disabled, className }: SchemaFormProps) {
  const shape = schema.shape as Record<string, ZodTypeAny>;
  const keys = [...order.filter((k) => k in shape), ...Object.keys(shape).filter((k) => !order.includes(k))].filter((k) => !omit.includes(k));
  const current = value ?? {};
  const set = (key: string, v: unknown) => {
    const next = { ...current };
    if (v === undefined) delete next[key];
    else next[key] = v;
    onChange(next);
  };
  return (
    <div className={cn("space-y-4", className)}>
      {keys.map((key) => (
        <SchemaField key={key} name={key} schema={shape[key]} value={current[key]} onChange={(v) => set(key, v)} businessId={businessId} options={options} errors={errors} path={joinPath(path, key)} disabled={disabled} />
      ))}
    </div>
  );
}

export interface SchemaFieldProps {
  name: string;
  schema: ZodTypeAny;
  value: unknown;
  onChange: (v: unknown) => void;
  businessId: string;
  options: EditorOptions;
  errors: Record<string, string>;
  path: string;
  disabled?: boolean;
}

export function SchemaField(props: SchemaFieldProps) {
  const { name, schema, value, onChange, businessId, options, errors, path, disabled } = props;
  const kind = fieldKind(schema);
  const info = unwrap(schema);
  const label = labelFromKey(name);
  const error = errors[path];
  const required = isRequired(schema);
  const hint = info.description;
  const id = `sf-${path.replace(/[^a-z0-9]+/gi, "-")}`;
  const ref = referenceKind(name);

  switch (kind) {
    case "string": {
      if (ref && !ref.multiple) {
        return (
          <Field label={label} htmlFor={id} hint={hint} error={error} required={required}>
            <ReferenceSelect id={id} kind={ref.kind} options={options} value={typeof value === "string" ? value : ""} onChange={(v) => onChange(v || undefined)} required={required} disabled={disabled} />
          </Field>
        );
      }
      const str = typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
      const maxLength = stringMaxLength(schema);
      const handle = (v: string) => onChange(v === "" && !required ? undefined : v);
      if (TEXTAREA_KEY_RE.test(name)) {
        const mono = MONOSPACE_KEY_RE.test(name);
        return (
          <Field label={label} htmlFor={id} hint={hint ?? (mono ? "Raw markup; scripts are not executed." : undefined)} error={error} required={required}>
            <Textarea id={id} value={str} onChange={(e) => handle(e.target.value)} maxLength={maxLength} disabled={disabled} className={cn(mono && "font-mono text-xs", name === "body" || name === "html" ? "min-h-[160px]" : "min-h-[80px]")} />
          </Field>
        );
      }
      return (
        <Field label={label} htmlFor={id} hint={hint} error={error} required={required}>
          <Input id={id} value={str} onChange={(e) => handle(e.target.value)} maxLength={maxLength} disabled={disabled} />
        </Field>
      );
    }
    case "number": {
      const c = numberConstraints(schema);
      const str = typeof value === "number" && Number.isFinite(value) ? String(value) : "";
      return (
        <Field label={label} htmlFor={id} hint={hint ?? (c.min !== undefined || c.max !== undefined ? `${c.min !== undefined ? `Min ${c.min}` : ""}${c.min !== undefined && c.max !== undefined ? " · " : ""}${c.max !== undefined ? `Max ${c.max}` : ""}` : undefined)} error={error} required={required}>
          <Input id={id} type="number" value={str} min={c.min} max={c.max} step={c.step} disabled={disabled} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
        </Field>
      );
    }
    case "boolean":
      return (
        <div className="space-y-1">
          <Checkbox id={id} checked={value === true} onChange={(e) => onChange(e.target.checked)} disabled={disabled} label={label} />
          {hint && <p className="text-xs text-neutral-500">{hint}</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      );
    case "enum": {
      const values = enumValues(schema);
      const str = typeof value === "string" ? value : "";
      return (
        <Field label={label} htmlFor={id} hint={hint} error={error} required={required}>
          <Select id={id} value={str} disabled={disabled} onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}>
            {(!required || !values.includes(str)) && <option value="">{required ? "Choose…" : "— Default —"}</option>}
            {values.map((v) => (
              <option key={v} value={v}>{labelFromKey(v)}</option>
            ))}
          </Select>
        </Field>
      );
    }
    case "string-array": {
      const list = Array.isArray(value) ? (value as unknown[]).map((v) => String(v)) : [];
      if (ref?.multiple) {
        return (
          <Field label={label} hint={hint} error={error} required={required}>
            <ReferenceMultiSelect kind={ref.kind} options={options} value={list} onChange={(v) => onChange(v)} disabled={disabled} />
          </Field>
        );
      }
      const el = unwrap((info.inner as z.ZodArray<ZodTypeAny>).element).inner;
      const choices = el instanceof z.ZodEnum ? (el.options as string[]) : null;
      return (
        <Field label={label} hint={hint} error={error} required={required}>
          <TagListEditor value={list} onChange={(v) => onChange(v)} choices={choices} disabled={disabled} path={path} errors={errors} />
        </Field>
      );
    }
    case "object-array": {
      const elementSchema = unwrap((info.inner as z.ZodArray<ZodTypeAny>).element).inner;
      const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      return (
        <Field label={label} hint={hint} error={error} required={required}>
          <RepeatableRows rows={rows} elementSchema={elementSchema} onChange={(v) => onChange(v)} businessId={businessId} options={options} errors={errors} path={path} disabled={disabled} label={label} />
        </Field>
      );
    }
    case "media":
      return <MediaField label={label} hint={hint} error={error} required={required} value={value as MediaRefValue | undefined} onChange={onChange} businessId={businessId} disabled={disabled} kind={/video/i.test(name) ? "VIDEO" : "IMAGE"} />;
    case "link":
      return <LinkField label={label} hint={hint} error={error} required={required} value={value as LinkValue | undefined} onChange={onChange} options={options} schema={info.inner} path={path} errors={errors} disabled={disabled} />;
    case "object": {
      const obj = (value ?? {}) as Record<string, unknown>;
      return (
        <fieldset className="rounded-lg border border-neutral-200 p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</legend>
          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
          <SchemaForm schema={info.inner as z.ZodObject<z.ZodRawShape>} value={obj} onChange={(v) => onChange(Object.keys(v).length === 0 && !required ? undefined : v)} businessId={businessId} options={options} errors={errors} path={path} disabled={disabled} />
        </fieldset>
      );
    }
    default:
      return <JsonField label={label} hint={hint} error={error} value={value} onChange={onChange} id={id} disabled={disabled} />;
  }
}

// ── Reference pickers ─────────────────────────────────────────────────────────

function optionsFor(kind: ReferenceKind, options: EditorOptions): EditorOptionItem[] {
  return options[kind] ?? [];
}

const REFERENCE_EMPTY: Record<ReferenceKind, string> = {
  services: "No services yet — add them under Services.",
  projects: "No projects yet — add them under Projects.",
  teamMembers: "No team members yet — add them under Team.",
  forms: "No forms yet — create one under Forms.",
  pages: "No pages yet.",
};

function ReferenceSelect({ id, kind, options, value, onChange, required, disabled }: { id: string; kind: ReferenceKind; options: EditorOptions; value: string; onChange: (v: string) => void; required?: boolean; disabled?: boolean }) {
  const items = optionsFor(kind, options);
  const known = items.some((i) => i.id === value);
  return (
    <div className="space-y-1">
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="">{required ? "Choose…" : "— None —"}</option>
        {!known && value && <option value={value}>{value} (not found)</option>}
        {items.map((it) => (
          <option key={it.id} value={it.id}>{it.label}{it.hint ? ` (${it.hint})` : ""}</option>
        ))}
      </Select>
      {items.length === 0 && <p className="text-xs text-neutral-500">{REFERENCE_EMPTY[kind]}</p>}
    </div>
  );
}

function ReferenceMultiSelect({ kind, options, value, onChange, disabled }: { kind: ReferenceKind; options: EditorOptions; value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const items = optionsFor(kind, options);
  if (items.length === 0) return <p className="text-xs text-neutral-500">{REFERENCE_EMPTY[kind]}</p>;
  const toggle = (id: string, on: boolean) => onChange(on ? [...value.filter((v) => v !== id), id] : value.filter((v) => v !== id));
  return (
    <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-md border border-neutral-200 p-2 sm:grid-cols-2">
      {items.map((it) => (
        <Checkbox key={it.id} checked={value.includes(it.id)} onChange={(e) => toggle(it.id, e.target.checked)} disabled={disabled} label={<span>{it.label}{it.hint && <span className="ml-1 text-xs text-neutral-400">({it.hint})</span>}</span>} />
      ))}
      {value.filter((v) => !items.some((i) => i.id === v)).length > 0 && <p className="text-xs text-amber-700 sm:col-span-2">Some selected items no longer exist and will be dropped on save.</p>}
    </div>
  );
}

// ── Arrays ────────────────────────────────────────────────────────────────────

function TagListEditor({ value, onChange, choices, disabled, path, errors }: { value: string[]; onChange: (v: string[]) => void; choices: string[] | null; disabled?: boolean; path: string; errors: Record<string, string> }) {
  const [draft, setDraft] = React.useState("");
  const idsRef = React.useRef<string[]>([]);
  // Stable ids per row so dnd-kit can track items whose text changes.
  while (idsRef.current.length < value.length) idsRef.current.push(`${path}-${Math.random().toString(36).slice(2, 9)}`);
  if (idsRef.current.length > value.length) idsRef.current = idsRef.current.slice(0, value.length);
  const ids = idsRef.current;
  const add = (text: string) => {
    const t = text.trim();
    if (!t) return;
    onChange([...value, t]);
    setDraft("");
  };
  const remove = (i: number) => {
    idsRef.current = ids.filter((_, j) => j !== i);
    onChange(value.filter((_, j) => j !== i));
  };
  const update = (i: number, v: string) => onChange(value.map((x, j) => (j === i ? v : x)));
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <SortableRows
          items={value}
          getId={(_, i) => ids[i]}
          disabled={disabled}
          onReorder={(next, from, to) => {
            const reordered = [...ids];
            const [moved] = reordered.splice(from, 1);
            reordered.splice(to, 0, moved);
            idsRef.current = reordered;
            onChange(next);
          }}
          renderRow={(item, i, handle) => (
            <div className="flex items-center gap-1">
              {handle}
              {choices ? (
                <Select value={item} onChange={(e) => update(i, e.target.value)} disabled={disabled}>
                  {choices.map((c) => (
                    <option key={c} value={c}>{labelFromKey(c)}</option>
                  ))}
                </Select>
              ) : (
                <Input value={item} onChange={(e) => update(i, e.target.value)} disabled={disabled} />
              )}
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)} aria-label="Remove" disabled={disabled}><Trash2 className="h-4 w-4" /></Button>
              {errors[`${path}.${i}`] && <span className="text-xs text-red-600">{errors[`${path}.${i}`]}</span>}
            </div>
          )}
        />
      )}
      <div className="flex items-center gap-2">
        {choices ? (
          <Select value={draft} onChange={(e) => setDraft(e.target.value)} disabled={disabled}>
            <option value="">Add…</option>
            {choices.map((c) => (
              <option key={c} value={c}>{labelFromKey(c)}</option>
            ))}
          </Select>
        ) : (
          <Input value={draft} placeholder="Type and press Enter to add" disabled={disabled} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(draft); } }} />
        )}
        <Button type="button" variant="secondary" size="sm" onClick={() => add(draft)} disabled={disabled || !draft.trim()}><Plus className="h-4 w-4" /> Add</Button>
      </div>
      {value.length === 0 && <p className="text-xs text-neutral-500">No items yet.</p>}
    </div>
  );
}

function rowSummary(row: Record<string, unknown>): string {
  for (const key of ["title", "label", "name", "question", "value", "heading"]) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 60);
  }
  const first = Object.values(row).find((v) => typeof v === "string" && v.trim());
  return typeof first === "string" ? first.trim().slice(0, 60) : "";
}

function RepeatableRows({ rows, elementSchema, onChange, businessId, options, errors, path, disabled, label }: { rows: Record<string, unknown>[]; elementSchema: ZodTypeAny; onChange: (v: Record<string, unknown>[]) => void; businessId: string; options: EditorOptions; errors: Record<string, string>; path: string; disabled?: boolean; label: string }) {
  const idsRef = React.useRef<string[]>([]);
  while (idsRef.current.length < rows.length) idsRef.current.push(`${path}-${Math.random().toString(36).slice(2, 9)}`);
  if (idsRef.current.length > rows.length) idsRef.current = idsRef.current.slice(0, rows.length);
  const ids = idsRef.current;
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const isObject = elementSchema instanceof z.ZodObject;
  const add = () => {
    const seed = (emptyValueFor(elementSchema) ?? {}) as Record<string, unknown>;
    onChange([...rows, seed]);
  };
  const remove = (i: number) => {
    idsRef.current = ids.filter((_, j) => j !== i);
    onChange(rows.filter((_, j) => j !== i));
  };
  const update = (i: number, v: Record<string, unknown>) => onChange(rows.map((r, j) => (j === i ? v : r)));
  const hasRowError = (i: number) => Object.keys(errors).some((k) => k === `${path}.${i}` || k.startsWith(`${path}.${i}.`));
  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <SortableRows
          items={rows}
          getId={(_, i) => ids[i]}
          disabled={disabled}
          onReorder={(next, from, to) => {
            const reordered = [...ids];
            const [moved] = reordered.splice(from, 1);
            reordered.splice(to, 0, moved);
            idsRef.current = reordered;
            onChange(next);
          }}
          renderRow={(row, i, handle) => {
            const open = !collapsed[ids[i]];
            return (
              <div className={cn("rounded-lg border bg-white", hasRowError(i) ? "border-red-300" : "border-neutral-200")}>
                <div className="flex items-center gap-1 px-2 py-1.5">
                  {handle}
                  <button type="button" className="flex flex-1 items-center gap-1 text-left text-sm" onClick={() => setCollapsed((c) => ({ ...c, [ids[i]]: open }))}>
                    {open ? <ChevronDown className="h-4 w-4 text-neutral-400" /> : <ChevronRight className="h-4 w-4 text-neutral-400" />}
                    <span className="font-medium text-neutral-800">{label.replace(/s$/i, "")} {i + 1}</span>
                    {!open && rowSummary(row) && <span className="ml-2 truncate text-xs text-neutral-500">{rowSummary(row)}</span>}
                  </button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)} aria-label="Remove row" disabled={disabled}><Trash2 className="h-4 w-4" /></Button>
                </div>
                {open && (
                  <div className="border-t border-neutral-100 px-3 py-3">
                    {isObject ? (
                      <SchemaForm schema={elementSchema as z.ZodObject<z.ZodRawShape>} value={row} onChange={(v) => update(i, v)} businessId={businessId} options={options} errors={errors} path={`${path}.${i}`} disabled={disabled} />
                    ) : (
                      <JsonField label="Value" value={row} onChange={(v) => update(i, v as Record<string, unknown>)} id={`${path}-${i}`} disabled={disabled} />
                    )}
                  </div>
                )}
              </div>
            );
          }}
        />
      )}
      {rows.length === 0 && <p className="text-xs text-neutral-500">No {label.toLowerCase()} yet. Add the first one.</p>}
      <Button type="button" variant="secondary" size="sm" onClick={add} disabled={disabled}><Plus className="h-4 w-4" /> Add {label.replace(/s$/i, "").toLowerCase()}</Button>
    </div>
  );
}

// ── Media & links ─────────────────────────────────────────────────────────────

export interface MediaRefValue {
  mediaId?: string | null;
  url?: string | null;
  alt?: string;
}

function MediaField({ label, hint, error, required, value, onChange, businessId, disabled, kind }: { label: string; hint?: string; error?: string; required: boolean; value: MediaRefValue | undefined; onChange: (v: unknown) => void; businessId: string; disabled?: boolean; kind: "IMAGE" | "VIDEO" }) {
  const current = value ?? {};
  const mediaId = typeof current.mediaId === "string" ? current.mediaId : null;
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      <div className="space-y-2 rounded-lg border border-neutral-200 p-3">
        <MediaPicker
          businessId={businessId}
          kind={kind}
          value={mediaId}
          onChange={(m) => {
            if (!m) onChange(required ? { mediaId: null, url: null, alt: current.alt ?? "" } : undefined);
            else onChange({ ...current, mediaId: m.id, url: null, alt: current.alt || m.alt || "" });
          }}
        />
        {(mediaId || current.url) && (
          <Input placeholder="Alt text (describes the image for accessibility and SEO)" value={current.alt ?? ""} disabled={disabled} onChange={(e) => onChange({ ...current, alt: e.target.value })} />
        )}
        {!mediaId && current.url && <p className="text-xs text-amber-700">This block references an external file. Choose a file from the media library to replace it.</p>}
      </div>
    </Field>
  );
}

export interface LinkValue {
  label?: string;
  href?: string;
  style?: string;
}

function LinkField({ label, hint, error, required, value, onChange, options, schema, path, errors, disabled }: { label: string; hint?: string; error?: string; required: boolean; value: LinkValue | undefined; onChange: (v: unknown) => void; options: EditorOptions; schema: ZodTypeAny; path: string; errors: Record<string, string>; disabled?: boolean }) {
  const current = value ?? {};
  const styleSchema = schema instanceof z.ZodObject ? (schema.shape as Record<string, ZodTypeAny>).style : undefined;
  const styles = styleSchema ? enumValues(styleSchema) : [];
  const defaultStyle = styleSchema ? (unwrap(styleSchema).defaultValue as string | undefined) : undefined;
  const update = (patch: Partial<LinkValue>) => {
    const next = { ...current, ...patch };
    if (!required && !next.label && !next.href) {
      onChange(undefined);
      return;
    }
    if (styles.length && !next.style) next.style = defaultStyle ?? styles[0];
    onChange(next);
  };
  const targets = [
    ...options.pages.filter((p) => p.href).map((p) => ({ group: "Pages", ...p })),
    ...options.services.filter((s) => s.href).map((s) => ({ group: "Services", ...s })),
    ...options.projects.filter((p) => p.href).map((p) => ({ group: "Projects", ...p })),
  ];
  const groups = [...new Set(targets.map((t) => t.group))];
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      <div className="grid gap-2 rounded-lg border border-neutral-200 p-3 sm:grid-cols-2">
        <Field label="Label" error={errors[`${path}.label`]} className="sm:col-span-2">
          <Input value={current.label ?? ""} disabled={disabled} onChange={(e) => update({ label: e.target.value })} />
        </Field>
        <Field label="Link (URL or path)" error={errors[`${path}.href`]}>
          <Input value={current.href ?? ""} placeholder="/contact, https://…, tel:…" disabled={disabled} onChange={(e) => update({ href: e.target.value })} />
        </Field>
        <Field label="Pick page">
          <Select value="" disabled={disabled} onChange={(e) => { const t = targets.find((x) => x.href === e.target.value); if (t) update({ href: t.href, label: current.label || t.label }); }}>
            <option value="">Choose a page…</option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {targets.filter((t) => t.group === g).map((t) => (
                  <option key={`${g}-${t.id}`} value={t.href}>{t.label}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        {styles.length > 0 && (
          <Field label="Style" error={errors[`${path}.style`]}>
            <Select value={current.style ?? defaultStyle ?? styles[0]} disabled={disabled} onChange={(e) => update({ style: e.target.value })}>
              {styles.map((s) => (
                <option key={s} value={s}>{labelFromKey(s)}</option>
              ))}
            </Select>
          </Field>
        )}
      </div>
    </Field>
  );
}

function JsonField({ label, hint, error, value, onChange, id, disabled }: { label: string; hint?: string; error?: string; value: unknown; onChange: (v: unknown) => void; id: string; disabled?: boolean }) {
  const [text, setText] = React.useState(() => (value === undefined ? "" : JSON.stringify(value, null, 2)));
  const [bad, setBad] = React.useState<string | undefined>();
  React.useEffect(() => {
    setText(value === undefined ? "" : JSON.stringify(value, null, 2));
  }, [value]);
  return (
    <Field label={label} htmlFor={id} hint={hint ?? "JSON value"} error={error ?? bad}>
      <textarea
        id={id}
        className={cn(inputClass, "min-h-[96px] font-mono text-xs")}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (!text.trim()) { setBad(undefined); onChange(undefined); return; }
          try { onChange(JSON.parse(text)); setBad(undefined); } catch { setBad("Invalid JSON"); }
        }}
      />
    </Field>
  );
}
