import { tenantDb } from "@/lib/db";
import { asArray, asObject } from "@/lib/json";
import { FORM_FIELD_TYPES, type FormFieldDefinition, type FormFieldType, type FormSettings } from "@/lib/site/public-api";
import type { SiteContext } from "@/lib/tenant/resolve";

export interface SiteForm {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  action: string;
  fields: FormFieldDefinition[];
  settings: FormSettings;
}

const KNOWN_TYPES = new Set<string>(FORM_FIELD_TYPES.map((t) => t.type));

/** Normalises the jsonb field list into FormFieldDefinition[] (unknown types become text). */
export function normalizeFormFields(raw: unknown): FormFieldDefinition[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: FormFieldDefinition[] = [];
  list.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const f = item as Record<string, unknown>;
    const key = typeof f.key === "string" && f.key ? f.key : typeof f.id === "string" && f.id ? f.id : `field_${index}`;
    const type = typeof f.type === "string" && KNOWN_TYPES.has(f.type) ? (f.type as FormFieldType) : "text";
    const options = Array.isArray(f.options)
      ? (f.options as unknown[])
          .map((o) => (typeof o === "string" ? { value: o, label: o } : o && typeof o === "object" ? { value: String((o as { value?: unknown }).value ?? (o as { label?: unknown }).label ?? ""), label: String((o as { label?: unknown }).label ?? (o as { value?: unknown }).value ?? "") } : null))
          .filter((o): o is { value: string; label: string } => !!o && o.value !== "")
      : undefined;
    out.push({
      id: typeof f.id === "string" && f.id ? f.id : key,
      key,
      type,
      label: typeof f.label === "string" && f.label ? f.label : key,
      required: f.required === true,
      placeholder: typeof f.placeholder === "string" ? f.placeholder : undefined,
      helpText: typeof f.helpText === "string" ? f.helpText : undefined,
      options,
      width: f.width === "half" ? "half" : "full",
      unit: typeof f.unit === "string" ? f.unit : undefined,
      min: typeof f.min === "number" ? f.min : undefined,
      max: typeof f.max === "number" ? f.max : undefined,
      maxFiles: typeof f.maxFiles === "number" ? f.maxFiles : undefined,
      defaultValue: typeof f.defaultValue === "string" ? f.defaultValue : f.defaultValue != null ? String(f.defaultValue) : undefined,
    });
  });
  return out;
}

/** Active form by slug (tenant-scoped). Returns null when missing so blocks can show an editor hint. */
export async function loadFormBySlug(ctx: SiteContext, slug: string | null | undefined): Promise<SiteForm | null> {
  if (!slug) return null;
  const db = tenantDb(ctx.business.id);
  const row = await db.form.findFirst({ where: { businessId: ctx.business.id, slug, isActive: true } });
  if (!row) return null;
  const settings = asObject<Record<string, unknown>>(row.settings);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    action: row.action,
    fields: normalizeFormFields(asArray(row.fields)),
    settings: {
      submitLabel: typeof settings.submitLabel === "string" ? settings.submitLabel : undefined,
      successMessage: typeof settings.successMessage === "string" ? settings.successMessage : undefined,
      redirectUrl: typeof settings.redirectUrl === "string" ? settings.redirectUrl : undefined,
    },
  };
}
